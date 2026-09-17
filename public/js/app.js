import { DOMESTIC_PREP_ITEMS, FACILITY_GROUPS, ITEM_INDEX, shoppingLinksFor } from "./catalog.js?v=1.7.0";
import { contractAnalysisCount, parseContractLocally } from "./contract.js?v=1.7.0";
import { buildRecommendations, calculateLuggageBands, candidateSearchItems, defaultFacilities, facilitySummary, parseCarriedItems, rebudget, validateProfile } from "./engine.js?v=1.7.0";

const STORAGE_KEY = "unikit-mvp-state-v2";
const DEFAULT_STATE = {
  route: "profile",
  profileComplete: false,
  facilitiesComplete: false,
  contractAnalysis: null,
  contractConfirmed: false,
  aiSettings: { source: "gemini", model: "gemini-3.1-flash-lite" },
  profile: { roomType: "", bedSize: "", moveIn: "", budget: 180, cooking: "", location: "", preparedFittedSheet: "", preparedFlatSheet: "", preparedPillow: "", preparedPillowcase: "", preparedDomestic: [], luggagePreset: "2x23", checkedBagCount: 2, checkedBagKg: 23, carryOnCount: 1, luggageSpace: "", guestCount: "", carriedText: "" },
  facilities: defaultFacilities(),
  parsedCarried: { items: [], ambiguous: [], unmatched: [], source: "local-rules" },
  result: null
};

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return structuredClone(DEFAULT_STATE);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...saved,
      aiSettings: { ...DEFAULT_STATE.aiSettings, ...(saved.aiSettings || {}) },
      profile: { ...DEFAULT_STATE.profile, ...(saved.profile || {}) },
      facilities: { ...defaultFacilities(), ...(saved.facilities || {}) }
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = loadState();
let filter = "all";
let toastTimer;
let aiCapabilities = {
  runtime: "standalone",
  sources: {
    gemini: { available: false, status: "server_required", model: "gemini-3.1-flash-lite", models: ["gemini-3.1-flash-lite", "gemini-3-flash-preview"] },
    openai: { available: false, status: "server_required", model: "gpt-5-mini", models: ["gpt-5-mini", "gpt-5.4-mini"] },
    codex: { available: false, status: "desktop_only" },
    demo: { available: true, status: "ready" }
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const formatMoney = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: Number(value) % 1 ? 2 : 0 }).format(Number(value) || 0);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const LUGGAGE_PRESETS = {
  "2x23": { checkedBagCount: 2, checkedBagKg: 23, carryOnCount: 1 },
  "1x23": { checkedBagCount: 1, checkedBagKg: 23, carryOnCount: 1 },
  "2x20": { checkedBagCount: 2, checkedBagKg: 20, carryOnCount: 1 }
};
const DEFAULT_BED_BY_ROOM = { "ensuite-small-double": "small-double", "studio-double": "double", "shared-single": "single", "shared-bath-single": "single", "twin-single": "single", unknown: "unknown" };
const CONTRACT_PROFILE_LABELS = { roomType: "房型", bedSize: "床型" };
const CONTRACT_VALUE_LABELS = {
  "ensuite-small-double": "En-suite", "studio-double": "Studio", "shared-single": "Shared flat", "shared-bath-single": "Shared bathroom", "twin-single": "Twin room",
  single: "Single", "small-double": "Small Double", double: "Double", yes: "有", no: "没有", unknown: "不确定", induction: "电磁炉", electric: "普通电炉", private: "独立卫浴", shared: "公共卫浴", limited: "很有限", normal: "一般 / 充足"
};
const CONFIDENCE_LABELS = { high: "高置信度", medium: "中置信度", low: "需确认" };

function saveState() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* Some browsers restrict storage for local files; the current page still works. */ }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

async function api(path, body) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const error = new Error(`Request failed with ${response.status}`);
    error.response = await response.json().catch(() => ({}));
    throw error;
  }
  return response.json();
}

async function checkServices() {
  if (location.protocol === "file:") {
    state.aiSettings.source = "demo";
    updateServiceChip();
    renderAISettings();
    return;
  }
  try {
    aiCapabilities = await api("/api/ai-settings");
    const selected = aiCapabilities.sources[state.aiSettings.source];
    if (!selected?.available || state.aiSettings.source === "codex") state.aiSettings.source = aiCapabilities.preferredSource || "demo";
    const provider = aiCapabilities.sources[state.aiSettings.source];
    const allowedModels = provider?.models || [];
    if (allowedModels.length && !allowedModels.includes(state.aiSettings.model)) state.aiSettings.model = provider.model || allowedModels[0];
    saveState();
  } catch {
    state.aiSettings.source = "demo";
  }
  updateServiceChip();
  renderAISettings();
}

function currentAISource() {
  return location.protocol === "file:" ? "demo" : state.aiSettings.source || "demo";
}

function updateServiceChip() {
  const trigger = $("#ai-settings-open");
  const label = $("#service-mode");
  const source = currentAISource();
  const live = ["gemini", "openai"].includes(source) && aiCapabilities.sources[source]?.available;
  trigger.className = `mode-chip settings-trigger ${live ? "live" : "demo"}`;
  const providerName = source === "gemini" ? "Gemini 免费层" : "OpenAI";
  label.textContent = live ? `${providerName} · ${state.aiSettings.model}` : "演示模式 · 点击设置";
}

function setConnectionStatus(title, detail, type = "") {
  const status = $("#ai-connection-status");
  status.className = `connection-status ${type}`.trim();
  status.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(detail)}</span>`;
}

function renderAISettings() {
  const gemini = aiCapabilities.sources.gemini || { available: false, model: "gemini-3.1-flash-lite", models: ["gemini-3.1-flash-lite"] };
  const openai = aiCapabilities.sources.openai;
  const source = currentAISource();
  const sourceInput = $(`input[name="aiSource"][value="${source}"]`);
  if (sourceInput) sourceInput.checked = true;
  const geminiInput = $('input[name="aiSource"][value="gemini"]');
  geminiInput.disabled = !gemini.available;
  const geminiBadge = $("#gemini-source-badge");
  geminiBadge.className = `source-badge ${gemini.available ? "" : "warning"}`.trim();
  geminiBadge.textContent = gemini.available ? "免费层已配置" : location.protocol === "file:" ? "需服务器" : "待配置";

  const openaiInput = $('input[name="aiSource"][value="openai"]');
  openaiInput.disabled = !openai.available;
  const badge = $("#openai-source-badge");
  badge.className = `source-badge ${openai.available ? "" : "warning"}`.trim();
  badge.textContent = openai.available ? "已配置" : location.protocol === "file:" ? "需服务器" : "待配置";

  const modelSelect = $("#ai-model");
  const provider = source === "gemini" ? gemini : source === "openai" ? openai : null;
  const models = provider?.models?.length ? provider.models : [state.aiSettings.model];
  modelSelect.innerHTML = models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}${model === provider?.model ? " · 服务器默认" : ""}</option>`).join("");
  modelSelect.value = models.includes(state.aiSettings.model) ? state.aiSettings.model : (provider?.model || models[0]);
  const modelEnabled = Boolean(provider?.available);
  modelSelect.disabled = !modelEnabled;
  $("#ai-model-label").textContent = source === "gemini" ? "Gemini 模型" : source === "openai" ? "OpenAI 模型" : "AI 模型";
  $("#model-settings").classList.toggle("is-disabled", !modelEnabled);
  $("#test-ai-connection").disabled = ["gemini", "openai"].includes(source) ? !provider?.available : source === "codex";

  if (source === "gemini" && gemini.available) setConnectionStatus("Gemini 免费层已配置", "可识别脱敏PDF和图片；每位访客每日调用次数有限，密钥不会进入浏览器。", "success");
  else if (source === "openai" && openai.available) setConnectionStatus("OpenAI API 已配置", "点击测试可检查模型权限与 API 余额；不会显示或传回密钥。", "success");
  else if (source === "demo") setConnectionStatus("演示模式可用", "粘贴文字可由本地规则预填；PDF 和图片不会被伪装成已识别。", "warning");
  else setConnectionStatus("当前来源不可用", "Codex 桌面 Agent 只用于开发协作，不能作为公开网页的运行时接口。", "warning");
}

function openAISettings() {
  renderAISettings();
  $("#ai-settings-layer").hidden = false;
  document.body.classList.add("settings-open");
  $("#ai-settings-close").focus();
}

function closeAISettings() {
  $("#ai-settings-layer").hidden = true;
  document.body.classList.remove("settings-open");
  $("#ai-settings-open").focus();
}

async function testAIConnection() {
  const source = new FormData($("#ai-settings-form")).get("aiSource") || "demo";
  const model = $("#ai-model").value || state.aiSettings.model;
  const button = $("#test-ai-connection");
  if (source === "demo") {
    setConnectionStatus("演示模式正常", "本地规则无需网络和 API 额度；只支持文字输入。", "success");
    return;
  }
  button.disabled = true;
  button.textContent = "正在测试…";
  const providerName = source === "gemini" ? "Gemini 免费层" : "OpenAI";
  setConnectionStatus(`正在检查 ${providerName}`, "将发送一个最小请求，验证密钥、模型权限和可用额度。", "");
  try {
    const result = await api("/api/ai-test", { source, model });
    setConnectionStatus("连接成功", `${result.provider} · ${result.model} 可以用于合同识别。`, "success");
  } catch (error) {
    setConnectionStatus("连接失败", error.response?.message || "请检查服务器配置、模型权限和可用额度。", "error");
  } finally {
    button.disabled = false;
    button.textContent = "测试当前连接";
  }
}

function contractValueLabel(value) {
  return CONTRACT_VALUE_LABELS[value] || value || "不确定";
}

function contractRecordMarkup(record) {
  if (!record) return "";
  const unknown = !record.value || record.value === "unknown";
  const evidence = record.evidence ? `“${escapeHtml(record.evidence)}”` : "材料中未找到明确依据";
  return `<span class="ai-value ${unknown ? "unknown" : ""}">${escapeHtml(contractValueLabel(record.value))}</span><span class="confidence ${escapeHtml(record.confidence || "low")}">${escapeHtml(CONFIDENCE_LABELS[record.confidence] || "需确认")}</span><small>${evidence}</small>`;
}

function renderContractAnalysis() {
  const analysis = state.contractAnalysis;
  const result = $("#contract-result");
  const banner = $("#ai-confirmation-banner");
  const confirmation = $("#ai-confirmation-control");
  const profileTargets = { roomType: $("#room-type-ai"), bedSize: $("#bed-size-ai") };
  for (const target of Object.values(profileTargets)) { target.hidden = !analysis; target.innerHTML = ""; }
  result.hidden = !analysis;
  banner.hidden = !analysis;
  confirmation.hidden = !analysis;
  $("#facilities-title").textContent = analysis ? "确认AI识别结果" : "确认宿舍设施";
  $("#facilities-subtitle").textContent = analysis ? "AI只负责预填；你可以修改任何选项。“不确定”不会被当成“没有”。" : "逐项确认宿舍已经提供的设施；“不确定”不会被当成“没有”。";
  if (!analysis) return;

  const count = contractAnalysisCount(analysis);
  const isAIAnalysis = ["gemini-contract", "openai-contract"].includes(analysis.source);
  const sourceLabel = analysis.source === "gemini-contract" ? "Gemini合同识别" : analysis.source === "openai-contract" ? "OpenAI合同识别" : "本地演示识别";
  const sourceDetail = isAIAnalysis && analysis.model ? ` · ${analysis.model}` : "";
  result.innerHTML = `
    <div class="contract-result-head"><div><b>${escapeHtml(sourceLabel)}完成</b><small>${escapeHtml(analysis.fileName || "合同文字")} · 识别 ${count} 项${escapeHtml(sourceDetail)}</small></div><span>${isAIAnalysis ? "AI" : "演示"}</span></div>
    <div class="contract-profile-results">
      ${Object.entries(analysis.profile || {}).map(([key, record]) => `<div><b>${escapeHtml(CONTRACT_PROFILE_LABELS[key] || key)}</b>${contractRecordMarkup(record)}</div>`).join("")}
    </div>
    <p>已自动填写对应选项。请继续补充预算、行李等个人信息，并在页面2逐项确认宿舍设施。</p>`;

  for (const [key, target] of Object.entries(profileTargets)) {
    const record = analysis.profile?.[key];
    target.hidden = false;
    target.innerHTML = `<b>AI识别：</b>${contractRecordMarkup(record)}`;
  }
  banner.className = `notice ${isAIAnalysis ? "info" : "warning"}`;
  banner.innerHTML = `<b>${escapeHtml(sourceLabel)}</b><span>合同共识别 ${count} 项。每项均显示原文依据；未提及的信息保持“不确定”，请人工确认后再生成方案。</span>`;
  $("#confirm-ai-results").checked = Boolean(state.contractConfirmed);
}

function applyContractAnalysis(analysis) {
  state.contractAnalysis = analysis;
  state.contractConfirmed = false;
  const roomType = analysis.profile?.roomType?.value || "unknown";
  const bedSize = analysis.profile?.bedSize?.value || "unknown";
  $("#room-type").value = roomType;
  $("#bed-size").value = bedSize;
  state.profile.roomType = roomType;
  state.profile.bedSize = bedSize;
  for (const group of FACILITY_GROUPS) {
    for (const field of group.fields) state.facilities[field.id] = analysis.facilities?.[field.id]?.value || "unknown";
  }
  state.facilitiesComplete = false;
  state.result = null;
  renderFacilities();
  renderContractAnalysis();
  saveState();
}

function setContractStatus(message, type = "info") {
  const status = $("#contract-status");
  status.hidden = !message;
  status.className = `contract-status ${type}`;
  status.textContent = message;
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("文件读取失败")));
    reader.readAsDataURL(file);
  });
}

function fileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("文件读取失败")));
    reader.readAsText(file, "utf-8");
  });
}

async function analyzeContract() {
  const button = $("#analyze-contract");
  const file = $("#contract-file").files?.[0];
  let text = $("#contract-text").value.trim();
  if (!file && !text) {
    setContractStatus("请上传合同，或粘贴一段住宿说明。", "error");
    return;
  }
  if (file && file.size > 4 * 1024 * 1024) {
    setContractStatus("文件不能超过 4MB。可以截取包含房型和设施的关键页面后再上传。", "error");
    return;
  }
  button.disabled = true;
  button.textContent = "正在识别合同…";
  setContractStatus("正在提取房型、床型和宿舍设施；未出现的信息会保留为“不确定”。", "loading");
  try {
    const plainTextFile = file && (file.type === "text/plain" || /\.(txt|md)$/i.test(file.name));
    if (plainTextFile) text = [text, await fileAsText(file)].filter(Boolean).join("\n");
    const payload = {
      text: text.slice(0, 12000),
      fileName: file?.name || "粘贴的住宿说明",
      mimeType: file?.type || "text/plain",
      fileData: file && !plainTextFile ? await fileAsDataUrl(file) : "",
      aiSource: currentAISource(),
      aiModel: state.aiSettings.model
    };
    let analysis;
    if (payload.aiSource === "demo") {
      if (!text) {
        const error = new Error("DEMO_FILE_UNSUPPORTED");
        error.response = { message: "演示模式不能读取PDF或图片。请切换到已配置的Gemini或OpenAI API，或粘贴合同文字。" };
        throw error;
      }
      analysis = parseContractLocally(text, { fileName: payload.fileName });
    } else {
      analysis = await api("/api/parse-contract", payload);
    }
    applyContractAnalysis(analysis);
    const isAIAnalysis = ["gemini-contract", "openai-contract"].includes(analysis.source);
    setContractStatus(isAIAnalysis ? `AI识别完成（${analysis.model || state.aiSettings.model}）。请检查自动填写内容，并在页面2完成人工确认。` : "已使用本地演示规则预填；这是文字规则结果，不是AI解析。", isAIAnalysis ? "success" : "warning");
  } catch (error) {
    setContractStatus(error.response?.message || "当前无法识别这个文件。你仍然可以手动填写，或粘贴合同文字后重试。", "error");
  } finally {
    button.disabled = false;
    button.textContent = "识别并自动填写";
  }
}

function loadExampleContract() {
  $("#contract-file").value = "";
  $("#contract-text").value = "Your en-suite room contains a 4ft small double bed and mattress. Bed linen and pillows are not provided. The shared kitchen includes an induction hob, microwave and kettle. A laundry room is available. The contract does not mention a dishwasher, vacuum cleaner or drying rack.";
  setContractStatus("示例已填入。点击“识别并自动填写”查看AI预填与人工确认流程。", "info");
}

function clearContractAnalysis() {
  state.contractAnalysis = null;
  state.contractConfirmed = false;
  $("#contract-file").value = "";
  $("#contract-text").value = "";
  setContractStatus("", "info");
  renderFacilities();
  renderContractAnalysis();
  saveState();
}

function luggageValuesFromControls() {
  const preset = $("#luggage-preset").value;
  const fixed = LUGGAGE_PRESETS[preset];
  return {
    luggagePreset: preset,
    checkedBagCount: fixed?.checkedBagCount ?? Number($("#checked-bag-count").value),
    checkedBagKg: fixed?.checkedBagKg ?? Number($("#checked-bag-kg").value),
    carryOnCount: fixed?.carryOnCount ?? Number($("#carry-on-count").value)
  };
}

function renderLuggageOptions() {
  const allowance = luggageValuesFromControls();
  const plan = calculateLuggageBands(allowance);
  const current = new FormData($("#profile-form")).get("luggageSpace") || state.profile.luggageSpace;
  $("#luggage-allowance-summary").textContent = plan.allowanceSummary;
  $("#luggage-options").innerHTML = Object.entries(plan.options).map(([value, option]) => `
    <label class="luggage-option">
      <input type="radio" name="luggageSpace" value="${escapeHtml(value)}" ${current === value ? "checked" : ""} required>
      <span><b>${escapeHtml(option.title)}</b><small>${escapeHtml(option.detail)}</small></span>
    </label>`).join("");
}

function initializeLuggagePlanner() {
  $("#luggage-preset").value = state.profile.luggagePreset || "2x23";
  $("#checked-bag-count").value = state.profile.checkedBagCount || 2;
  $("#checked-bag-kg").value = state.profile.checkedBagKg || 23;
  $("#carry-on-count").value = Number.isFinite(Number(state.profile.carryOnCount)) ? state.profile.carryOnCount : 1;
  const fixed = LUGGAGE_PRESETS[$("#luggage-preset").value];
  if (fixed) {
    $("#checked-bag-count").value = fixed.checkedBagCount;
    $("#checked-bag-kg").value = fixed.checkedBagKg;
    $("#carry-on-count").value = fixed.carryOnCount;
  }
  $("#custom-luggage").hidden = $("#luggage-preset").value !== "custom";
  renderLuggageOptions();
}

function renderFacilities() {
  const container = $("#facility-groups");
  container.innerHTML = FACILITY_GROUPS.map((group) => `
    <section class="facility-group" aria-labelledby="group-${group.id}">
      <h2 id="group-${group.id}"><span aria-hidden="true">${escapeHtml(group.icon)}</span>${escapeHtml(group.label)}</h2>
      ${group.fields.map((field) => {
        const insight = state.contractAnalysis?.facilities?.[field.id];
        return `
        <div class="facility-row">
          <div class="facility-label"><span>${escapeHtml(field.label)}</span>${insight ? `<div class="facility-ai-meta">${contractRecordMarkup(insight)}</div>` : ""}</div>
          <select name="${escapeHtml(field.id)}" aria-label="${escapeHtml(field.label)}">
            ${field.options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${state.facilities[field.id] === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
          </select>
        </div>`;
      }).join("")}
    </section>`).join("");
  $$('select', container).forEach((select) => select.addEventListener("change", () => {
    state.facilities[select.name] = select.value;
    state.contractConfirmed = false;
    $("#confirm-ai-results").checked = false;
    state.facilitiesComplete = false;
    state.result = null;
    saveState();
    updateFacilityFeedback();
  }));
  updateFacilityFeedback();
}

function renderDomesticPrepItems() {
  $("#domestic-prep-list").innerHTML = DOMESTIC_PREP_ITEMS.map((item) => `
    <label class="prep-check">
      <input type="checkbox" name="preparedDomestic" value="${escapeHtml(item.id)}">
      <b>${escapeHtml(item.label)}</b>
      <small>${escapeHtml(item.transport)}${item.remark ? ` · ${escapeHtml(item.remark)}` : ""}</small>
    </label>`).join("");
}

function updateFacilityFeedback() {
  $("#rule-summary").innerHTML = `<b>规则检查：</b><span>${escapeHtml(facilitySummary(state.facilities))}</span>`;
  $("#bed-warning").hidden = state.profile.bedSize !== "unknown";
}

function fillProfileForm() {
  const form = $("#profile-form");
  for (const [key, value] of Object.entries(state.profile)) {
    const control = form.elements[key];
    if (!control) continue;
    if (key === "preparedDomestic") {
      const selected = new Set(Array.isArray(value) ? value : []);
      $$('input[name="preparedDomestic"]', form).forEach((option) => { option.checked = selected.has(option.value); });
    } else if (["location", "luggageSpace"].includes(key)) {
      const option = form.querySelector(`input[name="${CSS.escape(key)}"][value="${CSS.escape(value)}"]`);
      if (option) option.checked = true;
    } else {
      control.value = value ?? "";
    }
  }
  if (!$("#bed-size").value && DEFAULT_BED_BY_ROOM[$("#room-type").value]) {
    $("#bed-size").value = DEFAULT_BED_BY_ROOM[$("#room-type").value];
  }
  $("#text-count").textContent = `${state.profile.carriedText.length} / 500`;
  renderParsedPreview();
  renderContractAnalysis();
}

function profileFromForm() {
  const data = new FormData($("#profile-form"));
  const luggage = luggageValuesFromControls();
  return {
    roomType: String(data.get("roomType") || ""),
    bedSize: String(data.get("bedSize") || ""),
    moveIn: String(data.get("moveIn") || ""),
    budget: Number(data.get("budget")),
    cooking: String(data.get("cooking") || ""),
    location: String(data.get("location") || ""),
    preparedFittedSheet: String(data.get("preparedFittedSheet") || ""),
    preparedFlatSheet: String(data.get("preparedFlatSheet") || ""),
    preparedPillow: String(data.get("preparedPillow") || ""),
    preparedPillowcase: String(data.get("preparedPillowcase") || ""),
    preparedDomestic: data.getAll("preparedDomestic").map(String),
    ...luggage,
    luggageSpace: String(data.get("luggageSpace") || ""),
    guestCount: String(data.get("guestCount") || ""),
    carriedText: String(data.get("carriedText") || "").trim()
  };
}

function showProfileErrors(errors) {
  const mapping = { roomType: "room-type", bedSize: "bed-size", moveIn: "move-in", budget: "budget", cooking: "cooking", location: "location", beddingPreparation: "bedding-preparation", luggageAllowance: "luggage-allowance", luggageSpace: "luggage-space", guestCount: "guest-count" };
  for (const [key, id] of Object.entries(mapping)) {
    const control = ["location", "beddingPreparation", "luggageAllowance", "luggageSpace"].includes(key) ? null : $(`#${id}`);
    if (control) control.setAttribute("aria-invalid", errors[key] ? "true" : "false");
    $(`#${id}-error`).textContent = errors[key] || "";
  }
  const summary = $("#form-summary");
  const count = Object.keys(errors).length;
  summary.hidden = count === 0;
  summary.textContent = count ? `请先修正 ${count} 处信息，再继续。` : "";
  if (count) {
    const firstKey = Object.keys(errors)[0];
    const firstId = mapping[firstKey];
    const focusTarget = firstKey === "luggageAllowance" ? $("#luggage-preset") : firstKey === "luggageSpace" ? $("#luggage-options input") : firstKey === "location" ? $('input[name="location"]') : firstKey === "beddingPreparation" ? $('[name="preparedFittedSheet"]') : firstId ? $(`#${firstId}`) : null;
    if (focusTarget) focusTarget.focus();
  }
}

function renderParsedPreview() {
  const preview = $("#parsed-preview");
  const parsed = state.parsedCarried;
  const hasContent = parsed.items?.length || parsed.ambiguous?.length || parsed.unmatched?.length;
  preview.hidden = !hasContent;
  if (!hasContent) return;
  const labels = parsed.items.map((item) => escapeHtml(item.label || ITEM_INDEX[item.itemId]?.zh || item.itemId));
  const uncertain = parsed.ambiguous.map((item) => escapeHtml(item.label || item.itemId));
  const source = ["gemini", "openai"].includes(parsed.source) ? "AI 结构化" : "本地词典";
  preview.innerHTML = `<b>${source}：</b>${labels.length ? `确认已带 ${labels.join("、")}` : "未识别到可直接排重的物品"}${uncertain.length ? `；<span class="ambiguous">待确认 ${uncertain.join("、")}，暂不自动排重</span>` : ""}${parsed.unmatched?.length ? `；未匹配 ${parsed.unmatched.map(escapeHtml).join("、")}` : ""}。`;
}

function updateNav(route) {
  const sequence = ["profile", "facilities", "results"];
  $$(".step-nav button").forEach((button) => {
    const target = button.dataset.route;
    const enabled = target === "profile" || (target === "facilities" && state.profileComplete) || (target === "results" && state.facilitiesComplete && state.result);
    button.disabled = !enabled;
    if (target === route || (route === "loading" && target === "results")) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
    const targetIndex = sequence.indexOf(target);
    const currentIndex = sequence.indexOf(route === "loading" ? "results" : route);
    button.classList.toggle("completed", enabled && targetIndex < currentIndex);
  });
}

function showPage(route, { focus = true } = {}) {
  if (route === "facilities" && !state.profileComplete) route = "profile";
  if (route === "results" && (!state.facilitiesComplete || !state.result)) route = state.profileComplete ? "facilities" : "profile";
  $$("[data-page]").forEach((page) => { page.hidden = page.dataset.page !== route; });
  state.route = route;
  saveState();
  updateNav(route);
  if (route !== "loading") history.replaceState(null, "", `#${route}`);
  if (focus) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const heading = $(`[data-page="${route}"] h1`);
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const profile = profileFromForm();
  const validation = validateProfile(profile);
  showProfileErrors(validation.errors);
  if (!validation.valid) return;
  const submit = event.submitter;
  submit.disabled = true;
  submit.textContent = "正在理解已带物品…";
  try {
    let parsed = parseCarriedItems(profile.carriedText);
    if (profile.carriedText && ["gemini", "openai"].includes(currentAISource())) {
      try { parsed = await api("/api/parse-items", { text: profile.carriedText, aiSource: currentAISource(), aiModel: state.aiSettings.model }); }
      catch { parsed = { ...parseCarriedItems(profile.carriedText), fallbackReason: "AI_PARSE_FAILED" }; }
    }
    state.profile = profile;
    state.parsedCarried = parsed;
    state.profileComplete = true;
    state.facilitiesComplete = false;
    state.result = null;
    saveState();
    renderParsedPreview();
    updateFacilityFeedback();
    showPage("facilities");
  } finally {
    submit.disabled = false;
    submit.innerHTML = '继续检查宿舍设施 <span aria-hidden="true">→</span>';
  }
}

function localFallbackResult() {
  const result = buildRecommendations({ profile: state.profile, facilities: state.facilities, parsedCarried: state.parsedCarried });
  const productGroups = candidateSearchItems(result).map((item) => ({
    itemId: item.itemId,
    query: item.ukProductName,
    factStatus: "rule-reference",
    candidates: [{ title: item.ukProductName, priceGbp: item.unitPriceGbp, factStatus: "rule-reference" }]
  }));
  return { ...result, productGroups, productDataMode: "local-reference" };
}

async function handleFacilitiesSubmit(event) {
  event.preventDefault();
  if (state.contractAnalysis && !$("#confirm-ai-results").checked) {
    const error = $("#ai-confirmation-error");
    error.hidden = false;
    error.textContent = "请先确认AI预填内容；你可以直接修改任何识别结果。";
    $("#confirm-ai-results").focus();
    return;
  }
  $("#ai-confirmation-error").hidden = true;
  state.contractConfirmed = Boolean(state.contractAnalysis);
  state.facilitiesComplete = true;
  saveState();
  showPage("loading");
  const rules = $("#load-rules");
  const products = $("#load-products");
  rules.className = "active";
  rules.querySelector("em").textContent = "处理中";
  products.className = "";
  products.querySelector("em").textContent = "等待";
  await delay(350);
  rules.className = "done";
  rules.querySelector("em").textContent = "完成";
  products.className = "active";
  products.querySelector("em").textContent = "查询中";
  try {
    state.result = await api("/api/recommendations", { profile: state.profile, facilities: state.facilities, parsedCarried: state.parsedCarried });
  } catch {
    state.result = localFallbackResult();
  }
  await delay(300);
  products.className = "done";
  products.querySelector("em").textContent = state.result.productDataMode === "live-api" ? "已获取" : state.result.productDataMode === "mixed" ? "部分获取" : state.result.productDataMode === "demo-snapshot" ? "演示快照" : state.result.productDataMode === "local-reference" ? "购买参考" : "已降级";
  saveState();
  renderResults();
  showPage("results");
}

function resultStatusLabel(result) {
  return result.budgetStatus === "insufficient" ? "预算不足" : "✓ 未超预算";
}

function diffText(result) {
  const removed = result.diff?.removedItems || [];
  const added = result.diff?.addedItems || [];
  if (!removed.length && !added.length) return "当前预算下，现有选择无需变化；P0 必需品优先保留。";
  const removedNames = removed.map((id) => ITEM_INDEX[id]?.zh || id);
  const addedNames = added.map((id) => ITEM_INDEX[id]?.zh || id);
  const parts = [];
  if (removedNames.length) parts.push(`${removedNames.join("、")}改为“以后再买”`);
  if (addedNames.length) parts.push(`${addedNames.join("、")}重新加入本周`);
  if (result.diff.savingsGbp > 0) parts.push(`本轮节省 ${formatMoney(result.diff.savingsGbp)}`);
  parts.push("P0 必需品仍优先保留");
  return `${parts.join("；")}。`;
}

function factNotice(result) {
  if (result.productDataMode === "live-api") return "商品候选来自本次实时 API 查询；通过商家白名单与规格检查的默认候选价格已进入预算。缺失字段显示“信息不足”，不会由 AI 补写。";
  if (result.productDataMode === "mixed") return "部分品类使用通过规格检查的 API 实价，其余保留规则参考价或带日期的演示快照；演示价格不会覆盖预算。";
  if (["demo-snapshot", "local-reference"].includes(result.productDataMode)) return "当前未配置商品 API。下方显示英文购买名、英国规则参考价和零售商搜索入口；点击后请以商家网站的实时价格、库存和配送信息为准。";
  return "商品服务不可用，因此只展示可测试的规则清单；没有生成商品名、实时价格或链接。";
}

function renderResults() {
  const result = state.result;
  if (!result) return;
  $("#metric-budget").textContent = formatMoney(result.budgetGbp);
  $("#metric-spend").textContent = formatMoney(result.spendGbp);
  $("#metric-left").textContent = formatMoney(result.remainingGbp);
  $("#metric-count").textContent = `${result.currentCount} 项`;
  $("#metric-count-label").textContent = `国内带 ${result.domesticCount || 0} · 英国买 ${result.ukCount || 0}`;
  const status = $("#budget-status");
  status.className = `status-pill ${result.budgetStatus === "insufficient" ? "danger" : "success"}`;
  status.textContent = resultStatusLabel(result);
  const input = $("#adjust-budget");
  const range = $("#budget-range");
  input.value = result.budgetGbp;
  range.value = Math.min(300, Math.max(40, result.budgetGbp));
  $("#budget-diff").textContent = diffText(result);
  const insufficient = $("#insufficient-notice");
  insufficient.hidden = result.budgetStatus !== "insufficient";
  insufficient.innerHTML = result.budgetStatus === "insufficient" ? `<b>P0 最低成本为 ${formatMoney(result.minimumP0Gbp)}</b><span>当前还差 ${formatMoney(result.shortfallGbp)}。系统没有为了“看起来成功”而删除关键必需品，请提高预算或明确接受缺口。</span>` : "";
  $("#fact-notice").textContent = factNotice(result);
  const allowanceLabel = result.luggagePlan?.allowanceLabel || calculateLuggageBands(result.profile).allowanceLabel;
  const preparedCount = (result.profile.preparedDomestic || []).length + [result.profile.preparedFittedSheet, result.profile.preparedFlatSheet, result.profile.preparedPillow, result.profile.preparedPillowcase].filter((value) => value === "yes").length;
  $("#stage-summary").innerHTML = `
    <div class="domestic"><span>出发前 · ${escapeHtml(allowanceLabel)} · 已准备 ${preparedCount} 项</span><strong>另建议国内带 ${result.domesticCount || 0} 项</strong></div>
    <div class="uk"><span>落地采购</span><strong>英国买 ${result.ukCount || 0} 项</strong></div>
    <div class="verify"><span>信息不足</span><strong>待核实 ${result.verifyCount || 0} 项${result.predepartureVerifyCount ? ` · 出发前 ${result.predepartureVerifyCount}` : ""}${result.arrivalVerifyCount ? ` · 入住后 ${result.arrivalVerifyCount}` : ""}</strong></div>
    <div><span>预算取舍</span><strong>以后再买 ${result.deferredCount || 0} 项</strong></div>`;
  renderShoppingList();
  renderProducts();
}

function renderShoppingList() {
  const result = state.result;
  const stageKey = (item) => item.state === "verify" ? "verify" : item.state === "deferred" ? "deferred" : item.buyStage === "国内带" ? "domestic" : "uk";
  const items = result.items.filter((item) => filter === "all" || stageKey(item) === filter);
  $("#shopping-list").innerHTML = items.length ? items.map((item) => `
    <article class="shopping-item" data-state="${escapeHtml(item.state)}">
      <div class="item-main"><div><strong>${escapeHtml(item.zhName)}</strong><span class="priority ${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span></div><small>${escapeHtml(item.ukProductName)} · 数量 ${escapeHtml(item.quantity)}</small></div>
      <div class="item-rule">${escapeHtml(item.reason)}${item.specWarning ? `<small>${escapeHtml(item.specWarning)}</small>` : ""}</div>
      <div class="item-price">${item.state === "verify" ? "—" : item.buyStage === "国内带" ? "不计入" : formatMoney(item.subtotalGbp)}<small>${item.state === "verify" ? "待核实，不计入预算" : item.buyStage === "国内带" ? `英国补购参考 ${formatMoney(item.subtotalGbp)}` : item.state === "deferred" ? "规则参考价" : item.priceType === "live-api" ? `API 实价 · ${escapeHtml((item.priceFetchedAt || "").slice(0, 10))}` : "规则参考价 · 计入预算"}</small></div>
      <span class="item-state ${escapeHtml(stageKey(item))}">${escapeHtml(item.buyStage)}</span>
    </article>`).join("") : '<div class="empty-products">此筛选条件下没有项目。</div>';
}

function renderProducts() {
  const groups = state.result.productGroups || [];
  const panel = $("#product-panel");
  if (!groups.length) {
    panel.innerHTML = '<div class="empty-products"><b>商品事实暂不可用</b><br>规则清单和预算仍然有效；系统不会让 AI 补写商品价格或链接。</div>';
    return;
  }
  panel.innerHTML = groups.map((group) => {
    const item = ITEM_INDEX[group.itemId];
    const snapshot = group.factStatus !== "live-api";
    const cards = group.candidates?.length ? group.candidates.map((candidate) => {
      const query = group.query || candidate.query || candidate.title || item?.en;
      const searchLinks = shoppingLinksFor({ category: item?.category, query });
      const directLink = candidate.url ? [{ label: "查看具体商品", url: candidate.url, direct: true }] : [];
      const links = [...directLink, ...searchLinks].slice(0, candidate.url ? 3 : 3);
      return `<div class="product-card">
        <div class="product-copy">
          <strong>${escapeHtml(candidate.title || query || "信息不足")}</strong>
          <span>${candidate.priceGbp ? `${snapshot ? "英国参考价" : "实时价格"} ${formatMoney(candidate.priceGbp)}` : "价格信息不足"}${!snapshot && candidate.merchant ? ` · ${escapeHtml(candidate.merchant)}` : ""}${candidate.selectedForBudget ? " · 已用于预算" : ""}</span>
          <small>${snapshot ? "搜索页会显示最新价格和库存；下单前核对尺寸、插头或炉灶规格。" : `${candidate.deliveryText ? escapeHtml(candidate.deliveryText) : "配送信息请在商品页确认"}${candidate.fetchedAt ? ` · 查询于 ${escapeHtml(candidate.fetchedAt.slice(0, 10))}` : ""}`}</small>
          <div class="purchase-links">${links.map((link) => `<a class="${link.direct ? "direct" : ""}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div>
        </div>
      </div>`;
    }).join("") : '<div class="empty-products">没有通过商家白名单和规格检查的候选；可先使用采购清单中的英文名搜索。</div>';
    return `<section class="product-group"><div class="product-group-head"><h3>${escapeHtml(item?.zh || group.itemId)}</h3><span class="source-badge ${snapshot ? "snapshot" : "live"}">${snapshot ? "购买参考" : "实时商品"}</span></div>${cards}</section>`;
  }).join("");
}

function updateBudget(rawValue) {
  const budget = Number(rawValue);
  if (!Number.isFinite(budget) || budget < 40 || budget > 500 || !state.result) return;
  state.result = rebudget(state.result, budget);
  state.profile.budget = budget;
  saveState();
  renderResults();
}

async function copySummary() {
  const result = state.result;
  const domestic = result.items.filter((item) => item.state === "current" && item.buyStage === "国内带");
  const uk = result.items.filter((item) => item.state === "current" && item.buyStage === "英国买");
  const verify = result.items.filter((item) => item.state === "verify");
  const deferred = result.items.filter((item) => item.state === "deferred");
  const text = [
    `UniKit Edinburgh 第一周采购清单`,
    `预算 ${formatMoney(result.budgetGbp)}｜预计 ${formatMoney(result.spendGbp)}｜剩余 ${formatMoney(result.remainingGbp)}`,
    "",
    "国内带（不计入英国预算）：",
    ...domestic.map((item) => `- ${item.zhName}：${item.reason}`),
    "",
    "英国买：",
    ...uk.map((item) => `- ${item.zhName} / ${item.ukProductName} / ${formatMoney(item.subtotalGbp)}`),
    ...(verify.length ? ["", "待核实：", ...verify.map((item) => `- ${item.zhName}（${item.buyStage}）：${item.reason}`)] : []),
    ...(deferred.length ? ["", "以后再买：", ...deferred.map((item) => `- ${item.zhName}`)] : [])
  ].join("\n");
  try { await navigator.clipboard.writeText(text); showToast("清单摘要已复制"); }
  catch { showToast("浏览器未允许复制，请手动选择清单"); }
}

function bindEvents() {
  $("#profile-form").addEventListener("submit", handleProfileSubmit);
  $("#facilities-form").addEventListener("submit", handleFacilitiesSubmit);
  $("#ai-settings-open").addEventListener("click", openAISettings);
  $$('[data-close-ai-settings]').forEach((control) => control.addEventListener("click", closeAISettings));
  $("#test-ai-connection").addEventListener("click", testAIConnection);
  $$('input[name="aiSource"]').forEach((input) => input.addEventListener("change", (event) => {
    const savedSource = state.aiSettings.source;
    state.aiSettings.source = event.target.value;
    renderAISettings();
    state.aiSettings.source = savedSource;
  }));
  $("#ai-settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const source = String(form.get("aiSource") || "demo");
    if (["gemini", "openai"].includes(source) && !aiCapabilities.sources[source]?.available) {
      const providerName = source === "gemini" ? "Gemini API" : "OpenAI API";
      const variableName = source === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
      setConnectionStatus(`${providerName} 尚未配置`, `请先在服务器端设置 ${variableName}。`, "error");
      return;
    }
    state.aiSettings = { source: source === "codex" ? "demo" : source, model: String(form.get("aiModel") || "local-rules") };
    saveState();
    updateServiceChip();
    closeAISettings();
    showToast(state.aiSettings.source === "gemini" ? `已切换到 Gemini 免费层 · ${state.aiSettings.model}` : state.aiSettings.source === "openai" ? `已切换到 OpenAI · ${state.aiSettings.model}` : "已切换到演示模式");
  });
  $("#analyze-contract").addEventListener("click", analyzeContract);
  $("#load-example-contract").addEventListener("click", loadExampleContract);
  $("#clear-contract").addEventListener("click", clearContractAnalysis);
  $("#contract-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    setContractStatus(file ? `已选择 ${file.name} · ${(file.size / 1024 / 1024).toFixed(2)}MB` : "", "info");
  });
  $("#confirm-ai-results").addEventListener("change", (event) => {
    state.contractConfirmed = event.target.checked;
    $("#ai-confirmation-error").hidden = event.target.checked;
    saveState();
  });
  $("#carried-text").addEventListener("input", (event) => { $("#text-count").textContent = `${event.target.value.length} / 500`; });
  $("#room-type").addEventListener("change", (event) => {
    const suggested = DEFAULT_BED_BY_ROOM[event.target.value];
    if (suggested) $("#bed-size").value = suggested;
    state.contractConfirmed = false;
  });
  $("#luggage-preset").addEventListener("change", (event) => {
    const fixed = LUGGAGE_PRESETS[event.target.value];
    $("#custom-luggage").hidden = event.target.value !== "custom";
    if (fixed) {
      $("#checked-bag-count").value = fixed.checkedBagCount;
      $("#checked-bag-kg").value = fixed.checkedBagKg;
      $("#carry-on-count").value = fixed.carryOnCount;
    }
    renderLuggageOptions();
  });
  ["#checked-bag-count", "#checked-bag-kg", "#carry-on-count"].forEach((selector) => $(selector).addEventListener("input", renderLuggageOptions));
  $("#list-filter").addEventListener("change", (event) => { filter = event.target.value; renderShoppingList(); });
  $("#adjust-budget").addEventListener("input", (event) => updateBudget(event.target.value));
  $("#budget-range").addEventListener("input", (event) => { $("#adjust-budget").value = event.target.value; updateBudget(event.target.value); });
  $("#copy-summary").addEventListener("click", copySummary);
  $("#reset-button").addEventListener("click", () => {
    const confirmed = window.confirm("确定清空本次会话中的资料并重新开始吗？");
    if (!confirmed) return;
    const savedAISettings = { ...state.aiSettings };
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Local-file storage may be unavailable. */ }
    state = structuredClone(DEFAULT_STATE);
    state.aiSettings = savedAISettings;
    renderDomesticPrepItems();
    initializeLuggagePlanner();
    fillProfileForm();
    renderFacilities();
    renderContractAnalysis();
    $("#contract-file").value = "";
    $("#contract-text").value = "";
    setContractStatus("", "info");
    showProfileErrors({});
    showPage("profile");
  });
  $$('[data-route]').forEach((control) => control.addEventListener("click", (event) => {
    event.preventDefault();
    const route = control.dataset.route;
    if (route === "results" && state.result) renderResults();
    showPage(route);
  }));
  window.addEventListener("hashchange", () => showPage(location.hash.slice(1) || "profile", { focus: false }));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#ai-settings-layer").hidden) closeAISettings();
  });
}

function init() {
  renderFacilities();
  renderDomesticPrepItems();
  initializeLuggagePlanner();
  fillProfileForm();
  bindEvents();
  checkServices();
  if (state.result) renderResults();
  const requested = location.hash.slice(1);
  showPage(requested || state.route || "profile", { focus: false });
}

init();
