import { BED_SIZES, CATALOG, DOMESTIC_PREP_ITEMS, ITEM_INDEX, ROOM_TYPES } from "./catalog.js?v=1.7.0";

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };
const CARRIED_RULES = [
  { id: "bedding_set", patterns: ["完整床品", "床品四件套", "四件套", "complete bedding", "bedding set"], expands: ["bedding_duvet", "bedding_fitted_sheet", "bedding_pillowcase"] },
  { id: "thin_blanket", patterns: ["薄毯子", "薄毯", "毛毯", "blanket", "throw"], ambiguous: true, label: "薄毯子（不能确认等同冬季被芯）" },
  { id: "bedding_duvet", patterns: ["被芯", "羽绒被", "冬被", "duvet"] },
  { id: "bedding_fitted_sheet", patterns: ["床笠", "床单", "fitted sheet", "bedsheet"] },
  { id: "bedding_pillow", patterns: ["枕头", "pillow"] },
  { id: "bedding_pillowcase", patterns: ["枕套", "pillowcase"] },
  { id: "bath_towel", patterns: ["浴巾", "毛巾", "bath towel", "towel"] },
  { id: "toiletries", patterns: ["洗漱用品", "洗护用品", "toiletries", "toothbrush", "牙刷", "洗发水"] },
  { id: "electric_extension", patterns: ["插线板", "排插", "extension lead", "power strip"] },
  { id: "electric_adapter", patterns: ["转换插头", "转接头", "旅行转换器", "travel adaptor", "travel adapter"] },
  { id: "clean_laundry_detergent", patterns: ["洗衣液", "洗衣粉", "laundry detergent"] },
  { id: "kitchen_cutlery", patterns: ["餐具", "刀叉", "cutlery"] },
  { id: "kitchen_bowl_mug", patterns: ["碗", "杯子", "mug", "bowl"] },
  { id: "kitchen_kettle", patterns: ["热水壶", "烧水壶", "kettle"] },
  { id: "kitchen_frying_pan", patterns: ["煎锅", "平底锅", "frying pan"] },
  { id: "kitchen_saucepan", patterns: ["汤锅", "奶锅", "saucepan"] },
  { id: "living_hangers", patterns: ["衣架", "hangers"] },
  { id: "living_drying_rack", patterns: ["晾衣架", "drying rack", "airer"] },
  { id: "living_desk_lamp", patterns: ["台灯", "desk lamp"] },
  { id: "living_slippers", patterns: ["拖鞋", "slippers"] }
];

const unique = (values) => [...new Set(values)];
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundHalf = (value) => Math.max(0.5, Math.round(Number(value) * 2) / 2);
const kgText = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");

function suitcaseText(value) {
  if (value === 0.25) return "1/4个箱子";
  if (value === 0.5) return "半个箱子";
  if (value === 0.75) return "3/4个箱子";
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}个箱子`;
}

export function calculateLuggageBands(profile = {}) {
  const checkedBagCount = Math.min(4, Math.max(1, Number(profile.checkedBagCount) || 2));
  const checkedBagKg = Math.min(32, Math.max(15, Number(profile.checkedBagKg) || 23));
  const carryOnCount = Math.min(2, Math.max(0, Number(profile.carryOnCount) || 0));
  const checkedTotalKg = money(checkedBagCount * checkedBagKg);
  // 生活用品空间按全部托运行李的占比表达，公斤数只是辅助换算。
  // 三档分别覆盖总额度的 25%—50%、50%—75% 和 75%—100%。
  const quarterKg = roundHalf(checkedTotalKg * 0.25);
  const halfKg = roundHalf(checkedTotalKg * 0.5);
  const threeQuarterKg = roundHalf(checkedTotalKg * 0.75);
  const fullKg = checkedTotalKg;
  const quarterBags = checkedBagCount * 0.25;
  const halfBags = checkedBagCount * 0.5;
  const threeQuarterBags = checkedBagCount * 0.75;
  const fullBags = checkedBagCount;
  return {
    checkedBagCount,
    checkedBagKg,
    carryOnCount,
    checkedTotalKg,
    quarterKg,
    halfKg,
    threeQuarterKg,
    fullKg,
    allowanceLabel: `${checkedBagCount} × ${checkedBagKg}kg${carryOnCount ? ` + ${carryOnCount} 件随身行李` : ""}`,
    allowanceSummary: `托运行李共 ${checkedTotalKg}kg（${checkedBagCount} 件，每件 ${checkedBagKg}kg）；下方按生活用品占全部托运行李的比例估算。`,
    options: {
      unknown: { title: "还没开始整理 / 不确定", detail: "采用保守方案，只建议国内带转换插头、常用个人用品等极小件。" },
      tight: { title: `生活用品占少部分：约${suitcaseText(quarterBags)}—${suitcaseText(halfBags)}`, detail: `按当前总额度约${kgText(quarterKg)}—${kgText(halfKg)}kg（25%—50%）；优先安排国内更熟悉、落地急用的物品。` },
      medium: { title: `生活用品约占一半以上：约${suitcaseText(halfBags)}—${suitcaseText(threeQuarterBags)}`, detail: `按当前总额度约${kgText(halfKg)}—${kgText(threeQuarterKg)}kg（50%—75%）；可带床品小件、洗漱用品和基础餐具。` },
      roomy: { title: `生活用品是行李主体：约${suitcaseText(threeQuarterBags)}—${suitcaseText(fullBags)}`, detail: `按当前总额度约${kgText(threeQuarterKg)}—${kgText(fullKg)}kg（75%—100%）；大件仍需比较体积、规格和英国购买成本。` }
    }
  };
}

export function defaultFacilities() {
  return {
    mattress: "yes", pillow: "no", desk_lamp: "unknown",
    microwave: "yes", kettle: "yes", stovetop: "induction", dishwasher: "unknown", kitchen_storage: "unknown",
    bathroom: "private", bathroom_bin: "no", bathroom_storage: "no",
    laundry: "yes", vacuum: "unknown", drying: "no"
  };
}

export function validateProfile(profile) {
  const errors = {};
  if (!ROOM_TYPES[profile.roomType]) errors.roomType = "请选择宿舍房型。";
  if (!BED_SIZES[profile.bedSize]) errors.bedSize = "请选择或确认床的大小。";
  if (!["within-7", "8-14", "over-14", "moved-in"].includes(profile.moveIn)) errors.moveIn = "请选择入住时间。";
  const budget = Number(profile.budget);
  if (!Number.isFinite(budget)) errors.budget = "请输入第一周总预算。";
  else if (budget < 40 || budget > 500) errors.budget = "预算需在 £40—£500 之间。";
  if (!["rarely", "sometimes", "daily"].includes(profile.cooking)) errors.cooking = "请选择做饭频率。";
  if (!["china", "uk"].includes(profile.location)) errors.location = "请选择当前所在位置。";
  if (!["2x23", "1x23", "2x20", "custom"].includes(profile.luggagePreset)) errors.luggageAllowance = "请选择或填写行李额度。";
  const bagCount = Number(profile.checkedBagCount);
  const bagKg = Number(profile.checkedBagKg);
  const carryCount = Number(profile.carryOnCount);
  if (!Number.isInteger(bagCount) || bagCount < 1 || bagCount > 4 || !Number.isFinite(bagKg) || bagKg < 15 || bagKg > 32 || !Number.isInteger(carryCount) || carryCount < 0 || carryCount > 2) errors.luggageAllowance = "托运行李需为 1—4 件、每件 15—32kg，随身行李为 0—2 件。";
  if (!["unknown", "tight", "medium", "roomy"].includes(profile.luggageSpace)) errors.luggageSpace = "请选择可用于生活用品的行李空间。";
  const preparationValues = [profile.preparedFittedSheet, profile.preparedFlatSheet, profile.preparedPillow, profile.preparedPillowcase];
  if (preparationValues.some((value) => !["yes", "no", "unknown"].includes(value))) errors.beddingPreparation = "请确认床笠、床单、枕头和枕套的准备情况。";
  if (profile.preparedDomestic !== undefined && !Array.isArray(profile.preparedDomestic)) errors.preparedDomestic = "其他已准备物品的格式无效。";
  if (!["none", "one-two", "three-plus"].includes(profile.guestCount)) errors.guestCount = "请选择常见招待人数。";
  if ((profile.carriedText || "").length > 500) errors.carriedText = "已携带物品不能超过 500 字。";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function parseCarriedItems(text = "") {
  const normalized = String(text).toLowerCase().normalize("NFKC");
  if (!normalized.trim()) return { items: [], ambiguous: [], unmatched: [], source: "local-rules" };
  const matches = [];
  const ambiguous = [];
  for (const rule of CARRIED_RULES) {
    const matchedText = rule.patterns.find((pattern) => normalized.includes(pattern.toLowerCase()));
    if (!matchedText) continue;
    const record = {
      itemId: rule.id,
      matchedText,
      confidence: rule.ambiguous ? 0.55 : 0.96,
      expands: rule.expands || [],
      label: rule.label || ITEM_INDEX[rule.id]?.zh || rule.id
    };
    if (rule.ambiguous) ambiguous.push(record);
    else matches.push(record);
  }
  const deduped = [...new Map(matches.map((item) => [item.itemId, item])).values()];
  const tokens = normalized.split(/[，,、；;。\n/]+/).map((value) => value.trim()).filter(Boolean);
  const unmatched = tokens.filter((token) => !CARRIED_RULES.some((rule) => rule.patterns.some((pattern) => token.includes(pattern.toLowerCase()))));
  return { items: deduped, ambiguous, unmatched: unique(unmatched).slice(0, 8), source: "local-rules" };
}

export function sanitizeParsedItems(parsed) {
  const allowedSpecial = new Set(["bedding_set", "thin_blanket"]);
  const validRecord = (record) => record && typeof record === "object" && (ITEM_INDEX[record.itemId] || allowedSpecial.has(record.itemId));
  return {
    items: Array.isArray(parsed?.items) ? parsed.items.filter(validRecord).map((item) => ({ ...item, expands: item.itemId === "bedding_set" ? ["bedding_duvet", "bedding_fitted_sheet", "bedding_pillowcase"] : [] })) : [],
    ambiguous: Array.isArray(parsed?.ambiguous) ? parsed.ambiguous.filter(validRecord) : [],
    unmatched: Array.isArray(parsed?.unmatched) ? parsed.unmatched.filter((item) => typeof item === "string").slice(0, 8) : [],
    source: parsed?.source === "openai" ? "openai" : "local-rules"
  };
}

function carriedIds(parsed) {
  const ids = [];
  for (const item of parsed.items || []) {
    if (ITEM_INDEX[item.itemId]) ids.push(item.itemId);
    if (Array.isArray(item.expands)) ids.push(...item.expands.filter((id) => ITEM_INDEX[id]));
  }
  return new Set(ids);
}

function shouldInclude(item, profile, facilities) {
  if (item.cooking && !item.cooking.includes(profile.cooking)) return false;
  if (item.bathroom && facilities.bathroom !== item.bathroom) return false;
  if (item.onlyWhenFacilityMissing && item.providedBy && facilities[item.providedBy] === "yes") return false;
  return true;
}

function queryFor(item, profile, facilities) {
  const bed = BED_SIZES[profile.bedSize] || BED_SIZES.unknown;
  let query = item.en;
  if (item.bedDependent && bed.query) query = `${bed.query} ${query}`;
  if (item.stovetopDependent && facilities.stovetop === "induction") query = `induction compatible ${query}`;
  if (item.id === "bedding_duvet") query += " 10.5 tog";
  if (item.spec?.includes("uk_plug")) query += " UK plug";
  return query;
}

function stateAndReason(item, profile, facilities) {
  const bed = BED_SIZES[profile.bedSize] || BED_SIZES.unknown;
  const preparation = beddingPreparationState(item, profile);
  if (preparation === "unknown") {
    return { state: "verify", verifyStage: "出发前核实", reason: "是否已经装入行李尚不确定，出发前整理时先核对。", specWarning: "床品准备状态待确认。" };
  }
  if (item.bedDependent && profile.bedSize === "unknown") {
    return { state: "verify", reason: "床型尚未确认，先查看合同或联系宿舍。", specWarning: "床型待核实；不能标记为已校验。" };
  }
  if (item.stovetopDependent && facilities.stovetop === "unknown") {
    return { state: "verify", reason: "炉灶类型不确定，入住后确认再购买。", specWarning: "需要核实炉具兼容性。" };
  }
  if (item.providedBy && facilities[item.providedBy] === "unknown") {
    return { state: "verify", reason: "宿舍是否提供尚不确定，入住后先核实。", specWarning: "设施信息不足。" };
  }
  if (item.stovetopDependent && facilities.stovetop === "induction") {
    return { state: "candidate", reason: "你计划做饭，且炉灶为电磁炉。", specWarning: "只保留明确标注 induction compatible 的候选。" };
  }
  if (item.bedDependent) {
    return { state: "candidate", reason: `按 ${bed.label}（${bed.dimensions}）生成英国搜索词。`, specWarning: item.id === "bedding_duvet" ? `${bed.label} 尺寸；被芯另需核对 Tog。` : `${bed.label} 尺寸需与商品字段一致。` };
  }
  if (item.id === "bath_shower_caddy") return { state: "candidate", reason: "公共卫浴提高了便携洗漱篮优先级。", specWarning: "" };
  if (item.providedBy) return { state: "candidate", reason: "宿舍明确未提供，因此加入候选。", specWarning: item.spec ? "购买前核对英国规格。" : "" };
  if (item.cooking) return { state: "candidate", reason: profile.cooking === "daily" ? "你基本每天做饭，保留基础厨房用品。" : "你每周做饭 3—5 次，保留基础厨房用品。", specWarning: "" };
  if (item.id === "electric_adapter" && profile.location === "china") return { state: "candidate", reason: "仍在国内，可优先从现有行李中准备。", specWarning: "英国 Type G 插头；同时核对设备电压。" };
  return { state: "candidate", reason: item.priority === "P0" ? "属于入住第一周的基础必需品。" : item.priority === "P1" ? "第一周建议准备。" : "舒适度物品，可在预算紧张时延后。", specWarning: item.spec ? "购买前核对英国规格。" : "" };
}

function purchaseDecision(item, profile, status) {
  if (status.state === "verify") return { stage: status.verifyStage || "入住后核实", channel: status.verifyStage === "出发前核实" ? "整理行李时核对" : "先核实住宿或规格", budgetCost: 0, note: "信息未确认前不建议下单。" };
  if (profile.location === "uk") return { stage: "英国买", channel: "英国零售渠道", budgetCost: item.price, note: "你已经到英国，国内携带不再是可执行的下一步。" };
  const conservativeCarry = profile.luggageSpace === "unknown" && item.carryMode === "prefer-domestic" && item.carryBulk === 1 && item.priority === "P0";
  const tightCarry = profile.luggageSpace === "tight" && item.carryMode === "prefer-domestic" && item.carryBulk === 1;
  const standardCarry = ["medium", "roomy"].includes(profile.luggageSpace) && item.carryMode === "prefer-domestic";
  const canCarryPreferred = conservativeCarry || tightCarry || standardCarry;
  const canCarryOptional = item.carryMode === "optional-domestic" && profile.luggageSpace === "roomy";
  if (canCarryPreferred || canCarryOptional) {
    const bands = calculateLuggageBands(profile);
    const electricalNote = item.spec?.includes("uk_plug") ? "出发前确认是英国 Type G 规格且电压适配。" : "体积较小，可减少落地后的零散采购。";
    const allowanceNote = `当前额度为 ${bands.allowanceLabel}，生活用品空间按“${bands.options[profile.luggageSpace].title}”执行。`;
    return { stage: "国内带", channel: "出发前装入行李", budgetCost: 0, note: `${electricalNote}${allowanceNote}` };
  }
  let note = "在英国购买，避免占用行李空间。";
  if (item.bedDependent) note = "床品受英国床型尺寸影响，确认尺寸后在英国购买更稳妥。";
  else if (item.stovetopDependent) note = "锅具需匹配现场炉灶，适合在英国确认兼容后购买。";
  else if (item.spec?.includes("uk_plug")) note = "电器需核对英国插头、电压和住宿限制，建议在英国购买。";
  else if (profile.luggageSpace === "tight") note = "行李空间紧张，改为英国落地购买。";
  return { stage: "英国买", channel: "英国零售渠道", budgetCost: item.price, note };
}

function beddingPreparationState(item, profile) {
  if (item.id === "bedding_fitted_sheet") {
    if (profile.preparedFittedSheet === "yes" || profile.preparedFlatSheet === "yes") return "yes";
    if (profile.preparedFittedSheet === "unknown" || profile.preparedFlatSheet === "unknown") return "unknown";
    return "no";
  }
  if (item.id === "bedding_pillow") return profile.preparedPillow;
  if (item.id === "bedding_pillowcase") return profile.preparedPillowcase;
  return "no";
}

function prepareBaseItems({ profile, facilities, parsedCarried }) {
  const owned = carriedIds(parsedCarried);
  const selectedPrep = new Set(Array.isArray(profile.preparedDomestic) ? profile.preparedDomestic : []);
  for (const prepItem of DOMESTIC_PREP_ITEMS) {
    if (!selectedPrep.has(prepItem.id)) continue;
    for (const itemId of prepItem.catalogItemIds || []) owned.add(itemId);
  }
  const excluded = [];
  const candidates = [];
  for (const item of CATALOG) {
    if (!shouldInclude(item, profile, facilities)) {
      if (item.providedBy && facilities[item.providedBy] === "yes") excluded.push({ itemId: item.id, reason: "宿舍已提供" });
      continue;
    }
    if (beddingPreparationState(item, profile) === "yes") {
      excluded.push({ itemId: item.id, reason: item.id === "bedding_fitted_sheet" ? "用户已准备床笠或床单" : "用户已准备" });
      continue;
    }
    if (owned.has(item.id)) {
      excluded.push({ itemId: item.id, reason: "用户已携带" });
      continue;
    }
    if (item.providedBy && facilities[item.providedBy] === "yes") {
      excluded.push({ itemId: item.id, reason: "宿舍已提供" });
      continue;
    }
    const quantity = item.quantityByGuests?.[profile.guestCount] || item.quantityByCooking?.[profile.cooking] || 1;
    const status = stateAndReason(item, profile, facilities);
    const purchase = purchaseDecision(item, profile, status);
    const socialReason = item.quantityByGuests && profile.guestCount !== "none" ? `常见招待人数使建议数量调整为 ${quantity}。` : "";
    const storageReason = item.stovetopDependent && facilities.kitchen_storage === "limited" ? "个人厨房储物有限，保持少量、多用途配置。" : "";
    const dishwasherNote = ["kitchen_cutlery", "kitchen_bowl_mug"].includes(item.id) && facilities.dishwasher === "yes" ? "优先选择可机洗材质。" : "";
    candidates.push({
      itemId: item.id,
      zhName: item.zh,
      ukProductName: queryFor(item, profile, facilities),
      category: item.category,
      priority: item.priority,
      quantity,
      priceType: purchase.stage === "国内带" ? "uk-replacement-reference" : "rule-reference",
      unitPriceGbp: item.price,
      subtotalGbp: money(item.price * quantity),
      budgetSubtotalGbp: purchase.stage === "英国买" ? money(item.price * quantity) : 0,
      channel: purchase.channel,
      plannedBuyStage: purchase.stage,
      buyStage: purchase.stage,
      reason: [status.reason, purchase.note, socialReason, storageReason].filter(Boolean).join(" "),
      specWarning: [status.specWarning, dishwasherNote].filter(Boolean).join(" "),
      ruleState: status.state,
      searchRisk: item.searchRisk || 0,
      productCandidates: [],
      factStatus: "rule-reference"
    });
  }
  candidates.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || (a.plannedBuyStage === "国内带" ? -1 : 0) - (b.plannedBuyStage === "国内带" ? -1 : 0)
    || b.searchRisk - a.searchRisk
    || a.itemId.localeCompare(b.itemId));
  return { baseItems: candidates.slice(0, 20), excluded };
}

export function applyBudget(baseItems, budget, previousItems = []) {
  const numericBudget = money(Number(budget));
  const previous = new Map(previousItems.map((item) => [item.itemId, item.state]));
  const actionable = baseItems.filter((item) => item.ruleState !== "verify");
  const p0 = actionable.filter((item) => item.priority === "P0");
  const flexible = actionable.filter((item) => item.priority !== "P0");
  const p0Cost = money(p0.reduce((sum, item) => sum + (item.budgetSubtotalGbp ?? item.subtotalGbp), 0));
  const insufficient = p0Cost > numericBudget;
  let running = p0Cost;
  const states = new Map(p0.map((item) => [item.itemId, "current"]));
  for (const item of flexible) {
    const budgetCost = item.budgetSubtotalGbp ?? item.subtotalGbp;
    if (!insufficient && money(running + budgetCost) <= numericBudget) {
      states.set(item.itemId, "current");
      running = money(running + budgetCost);
    } else {
      states.set(item.itemId, "deferred");
    }
  }
  for (const item of baseItems.filter((entry) => entry.ruleState === "verify")) states.set(item.itemId, "verify");
  const items = baseItems.map((item) => ({ ...item, state: states.get(item.itemId) || "deferred", buyStage: states.get(item.itemId) === "current" ? (item.plannedBuyStage || item.buyStage) : states.get(item.itemId) === "verify" ? (item.plannedBuyStage || "入住后核实") : "以后再买" }));
  const spend = money(items.filter((item) => item.state === "current").reduce((sum, item) => sum + (item.budgetSubtotalGbp ?? item.subtotalGbp), 0));
  const currentIds = new Set(items.filter((item) => item.state === "current").map((item) => item.itemId));
  const removed = items.filter((item) => previous.get(item.itemId) === "current" && !currentIds.has(item.itemId));
  const added = items.filter((item) => previous.get(item.itemId) && previous.get(item.itemId) !== "current" && currentIds.has(item.itemId));
  return {
    items,
    budgetGbp: numericBudget,
    spendGbp: spend,
    remainingGbp: money(Math.max(0, numericBudget - spend)),
    currentCount: items.filter((item) => item.state === "current").length,
    domesticCount: items.filter((item) => item.state === "current" && item.buyStage === "国内带").length,
    ukCount: items.filter((item) => item.state === "current" && item.buyStage === "英国买").length,
    verifyCount: items.filter((item) => item.state === "verify").length,
    predepartureVerifyCount: items.filter((item) => item.state === "verify" && item.buyStage === "出发前核实").length,
    arrivalVerifyCount: items.filter((item) => item.state === "verify" && item.buyStage === "入住后核实").length,
    deferredCount: items.filter((item) => item.state === "deferred").length,
    minimumP0Gbp: p0Cost,
    shortfallGbp: insufficient ? money(p0Cost - numericBudget) : 0,
    budgetStatus: insufficient ? "insufficient" : "within-budget",
    diff: {
      removedItems: removed.map((item) => item.itemId),
      addedItems: added.map((item) => item.itemId),
      savingsGbp: money(removed.reduce((sum, item) => sum + (item.budgetSubtotalGbp ?? item.subtotalGbp), 0) - added.reduce((sum, item) => sum + (item.budgetSubtotalGbp ?? item.subtotalGbp), 0)),
      retainedEssentials: items.filter((item) => item.priority === "P0" && item.state === "current").map((item) => item.itemId)
    }
  };
}

export function buildRecommendations(input) {
  const validation = validateProfile(input.profile || {});
  if (!validation.valid) {
    const error = new Error("Profile validation failed");
    error.code = "VALIDATION_ERROR";
    error.details = validation.errors;
    throw error;
  }
  const profile = { ...input.profile, budget: Number(input.profile.budget) };
  const facilities = { ...defaultFacilities(), ...(input.facilities || {}) };
  const parsedCarried = sanitizeParsedItems(input.parsedCarried || parseCarriedItems(profile.carriedText));
  const { baseItems, excluded } = prepareBaseItems({ profile, facilities, parsedCarried });
  return {
    profile,
    luggagePlan: calculateLuggageBands(profile),
    facilities,
    parsedCarried,
    excluded,
    baseItems,
    ...applyBudget(baseItems, profile.budget),
    warnings: buildWarnings(profile, facilities, parsedCarried),
    generatedAt: new Date().toISOString()
  };
}

export function rebudget(result, budget) {
  const next = applyBudget(result.baseItems || result.items || [], budget, result.items || []);
  return { ...result, ...next, profile: { ...result.profile, budget: Number(budget) }, generatedAt: new Date().toISOString() };
}

export function buildWarnings(profile, facilities, parsedCarried) {
  const warnings = [];
  if (profile.bedSize === "unknown") warnings.push("床型待核实：床品不能标记为尺寸已校验。");
  if ([profile.preparedFittedSheet, profile.preparedFlatSheet, profile.preparedPillow, profile.preparedPillowcase].includes("unknown")) warnings.push("床品准备情况有不确定项：出发前核对后再决定是否购买。");
  if (facilities.stovetop === "unknown" && profile.cooking !== "rarely") warnings.push("炉灶类型待核实：锅具暂不进入立即购买。");
  if (profile.moveIn === "within-7") warnings.push("入住在 7 天内：配送信息缺失时不能承诺按时送达。");
  if (parsedCarried.ambiguous?.length) warnings.push("已携带物品中有不确定匹配，未用于自动排重。");
  return warnings;
}

export function facilitySummary(facilities) {
  const excluded = [];
  if (facilities.microwave === "yes") excluded.push("微波炉");
  if (facilities.kettle === "yes") excluded.push("水壶");
  if (facilities.pillow === "yes") excluded.push("枕头");
  const notes = [];
  if (excluded.length) notes.push(`已有${excluded.join("、")}，不会重复推荐`);
  if (facilities.stovetop === "induction") notes.push("电磁炉会触发锅具兼容检查");
  else if (facilities.stovetop === "unknown") notes.push("炉灶类型不确定，锅具入住后核实");
  if (facilities.kitchen_storage === "limited") notes.push("个人厨房储物有限，锅具保持少量、多用途");
  if (facilities.dishwasher === "yes") notes.push("餐具优先检查可机洗材质");
  const unknown = [];
  if (facilities.desk_lamp === "unknown") unknown.push("台灯");
  if (facilities.vacuum === "unknown") unknown.push("吸尘器");
  if (facilities.drying === "unknown") unknown.push("晾衣设施");
  if (unknown.length) notes.push(`${unknown.join("、")}暂不确定，不会直接计入购买金额`);
  return `${notes.join("；")}。`;
}

export function attachProducts(result, productGroups = []) {
  const byId = new Map(productGroups.map((group) => [group.itemId, group]));
  const decorate = (item) => {
    const group = byId.get(item.itemId);
    if (!group) return item;
    const priced = (group.candidates || []).filter((candidate) => Number.isFinite(Number(candidate.priceGbp)) && Number(candidate.priceGbp) > 0);
    const selected = group.factStatus === "live-api" ? priced[0] : null;
    if (!selected) return { ...item, productCandidates: group.candidates || [], factStatus: group.factStatus || "unavailable" };
    const unitPriceGbp = money(selected.priceGbp);
    const subtotalGbp = money(unitPriceGbp * item.quantity);
    return {
      ...item,
      unitPriceGbp,
      subtotalGbp,
      budgetSubtotalGbp: item.plannedBuyStage === "英国买" ? subtotalGbp : 0,
      priceType: "live-api",
      priceFetchedAt: selected.fetchedAt || group.fetchedAt,
      selectedCandidateId: selected.externalId,
      productCandidates: (group.candidates || []).map((candidate) => ({ ...candidate, selectedForBudget: candidate.externalId === selected.externalId })),
      factStatus: "live-api"
    };
  };
  const baseItems = result.baseItems.map(decorate);
  const budgeted = applyBudget(baseItems, result.budgetGbp, result.items);
  const decoratedGroups = productGroups.map((group) => ({
    ...group,
    candidates: (group.candidates || []).map((candidate) => ({
      ...candidate,
      selectedForBudget: baseItems.some((item) => item.selectedCandidateId === candidate.externalId)
    }))
  }));
  return { ...result, ...budgeted, baseItems, productGroups: decoratedGroups };
}

export function candidateSearchItems(result, limit = 5) {
  return result.items
    .filter((item) => item.state === "current" && item.buyStage === "英国买" && item.searchRisk > 0)
    .sort((a, b) => b.searchRisk - a.searchRisk || b.subtotalGbp - a.subtotalGbp)
    .slice(0, limit);
}
