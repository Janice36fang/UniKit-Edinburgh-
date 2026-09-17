import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRecommendations, candidateSearchItems, parseCarriedItems, sanitizeParsedItems, attachProducts, rebudget } from "./public/js/engine.js";
import { parseContractLocally } from "./public/js/contract.js";
import { parseItemsWithOpenAI } from "./adapters/openai.mjs";
import { analyzeContractWithOpenAI } from "./adapters/contract.mjs";
import { analyzeContractWithGemini, parseItemsWithGemini, testGeminiConnection } from "./adapters/gemini.mjs";
import { merchantAllowlistFromEnv, searchProducts } from "./adapters/serpapi.mjs";
import { snapshotFor } from "./data/product-snapshot.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const AI_SOURCES = new Set(["auto", "gemini", "openai", "demo", "codex"]);
const geminiUsage = new Map();

async function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!(key in process.env)) process.env[key] = value;
  }
}

await loadDotEnv();

function openAIModels() {
  const configured = String(process.env.OPENAI_MODEL_ALLOWLIST || "gpt-5-mini,gpt-5.4-mini")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return [...new Set([process.env.OPENAI_MODEL || "gpt-5-mini", ...configured])];
}

function geminiModels() {
  const configured = String(process.env.GEMINI_MODEL_ALLOWLIST || "gemini-3.1-flash-lite,gemini-3-flash-preview")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return [...new Set([process.env.GEMINI_MODEL || "gemini-3.1-flash-lite", ...configured])];
}

function preferredAISource() {
  const configured = String(process.env.AI_DEFAULT_SOURCE || "").toLowerCase();
  if (configured === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (configured === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (configured === "demo") return "demo";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "demo";
}

function aiRequestSettings(body = {}) {
  const requestedSource = AI_SOURCES.has(body.aiSource) ? body.aiSource : "auto";
  const source = requestedSource === "auto" ? preferredAISource() : requestedSource;
  const models = source === "gemini" ? geminiModels() : source === "openai" ? openAIModels() : [];
  const requestedModel = typeof body.aiModel === "string" ? body.aiModel.trim() : "";
  const defaultModel = source === "gemini" ? (process.env.GEMINI_MODEL || models[0]) : source === "openai" ? (process.env.OPENAI_MODEL || models[0]) : "local-rules";
  return { source, model: models.includes(requestedModel) ? requestedModel : defaultModel, models };
}

function aiSettingsPayload() {
  const openAIModel = process.env.OPENAI_MODEL || "gpt-5-mini";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  return {
    runtime: "server",
    preferredSource: preferredAISource(),
    sources: {
      gemini: { available: Boolean(process.env.GEMINI_API_KEY), status: process.env.GEMINI_API_KEY ? "configured" : "missing_key", model: geminiModel, models: geminiModels(), tier: "free-compatible" },
      openai: { available: Boolean(process.env.OPENAI_API_KEY), status: process.env.OPENAI_API_KEY ? "configured" : "missing_key", model: openAIModel, models: openAIModels() },
      codex: { available: false, status: "desktop_only", reason: "Codex桌面Agent不提供可由普通网页直接调用的生产运行时接口。" },
      demo: { available: true, status: "ready" }
    }
  };
}

function publicAIError(error, provider = error.provider || "openai") {
  const code = String(error.upstreamCode || error.code || "AI_REQUEST_FAILED");
  const normalizedCode = code.toLowerCase();
  const providerName = provider === "gemini" ? "Gemini" : "OpenAI";
  if (provider === "gemini" && (normalizedCode === "resource_exhausted" || error.status === 429)) return { status: 429, payload: { error: code, message: "Gemini 免费额度或调用频率已达到上限，请稍后重试；表单和本地规则仍可继续使用。" } };
  if (["credit_balance_exhausted", "insufficient_quota"].includes(normalizedCode)) return { status: 402, payload: { error: code, message: "OpenAI API余额不足；请切换到Gemini免费层或演示模式。" } };
  if (["invalid_api_key", "authentication_error", "api_key_invalid", "permission_denied", "unauthenticated"].includes(normalizedCode) || error.status === 401 || error.status === 403) return { status: 401, payload: { error: code, message: `${providerName} API密钥无效或没有权限；请在服务器端更新密钥。` } };
  if (["model_not_found", "not_found"].includes(normalizedCode) || error.status === 404) return { status: 400, payload: { error: code, message: "当前项目无法使用所选模型；请在AI设置中更换模型。" } };
  if (normalizedCode === "invalid_file_data") return { status: 400, payload: { error: code, message: "上传文件内容或类型不正确，请重新选择PDF、PNG、JPG或WebP文件。" } };
  if (error.name === "TimeoutError") return { status: 504, payload: { error: "AI_TIMEOUT", message: "AI响应超时，请稍后重试。" } };
  return { status: 502, payload: { error: code, message: `${providerName}暂时无法完成请求；请测试连接或切换到演示模式。` } };
}

function clientAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function consumeGeminiAllowance(request) {
  const limit = Math.max(1, Math.min(100, Number(process.env.GEMINI_DAILY_LIMIT) || 8));
  const today = new Date().toISOString().slice(0, 10);
  const key = `${today}:${clientAddress(request)}`;
  const used = geminiUsage.get(key) || 0;
  if (used >= limit) return { allowed: false, limit, remaining: 0 };
  geminiUsage.set(key, used + 1);
  if (geminiUsage.size > 2000) {
    for (const storedKey of geminiUsage.keys()) if (!storedKey.startsWith(`${today}:`)) geminiUsage.delete(storedKey);
  }
  return { allowed: true, limit, remaining: limit - used - 1 };
}

function geminiRateLimitError(request) {
  const allowance = consumeGeminiAllowance(request);
  if (allowance.allowed) return null;
  return { status: 429, payload: { error: "LOCAL_DAILY_LIMIT", message: `为了保护免费额度，每位访客每天最多使用 ${allowance.limit} 次AI识别。你仍可手动填写或使用演示模式。` } };
}

async function testOpenAIConnection(model) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ model, store: false, max_output_tokens: 32, input: "Reply with OK only." })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("OpenAI connection test failed");
    error.status = response.status;
    error.upstreamCode = payload?.error?.code || payload?.error?.type || "AI_TEST_FAILED";
    throw error;
  }
  return { ok: true, provider: "OpenAI API", model: payload.model || model };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8_000_000) {
      const error = new Error("Request body is too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

async function parseContractHandler(body, request) {
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 12000) : "";
  const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 160) : "住宿合同";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
  const fileData = typeof body?.fileData === "string" ? body.fileData : "";
  const { source, model } = aiRequestSettings(body);
  const allowedMime = !fileData || mimeType === "application/pdf" || mimeType === "text/plain" || ["image/png", "image/jpeg", "image/webp"].includes(mimeType);
  if (!text && !fileData) return { status: 400, payload: { error: "EMPTY_CONTRACT", message: "请上传合同或粘贴住宿说明。" } };
  if (!allowedMime || fileData.length > 6_000_000) return { status: 400, payload: { error: "UNSUPPORTED_CONTRACT", message: "仅支持4MB以内的PDF、PNG、JPG、WebP或文本文件。" } };
  if (source === "codex") return { status: 501, payload: { error: "CODEX_RUNTIME_UNAVAILABLE", message: "Codex桌面Agent只能辅助开发，不能作为网页合同识别接口。请选择Gemini、OpenAI API或演示模式。" } };
  if (source === "demo") {
    if (text) return { status: 200, payload: parseContractLocally(text, { fileName }) };
    return { status: 422, payload: { error: "DEMO_FILE_UNSUPPORTED", message: "演示模式不能读取PDF或图片。请切换到已配置的Gemini或OpenAI API，或粘贴合同文字。" } };
  }
  if (source === "gemini" && !process.env.GEMINI_API_KEY) return { status: 503, payload: { error: "AI_NOT_CONFIGURED", message: "服务器尚未配置Gemini API。请切换到演示模式，或由项目管理员配置密钥。" } };
  if (source === "openai" && !process.env.OPENAI_API_KEY) return { status: 503, payload: { error: "AI_NOT_CONFIGURED", message: "服务器尚未配置OpenAI API。请切换到演示模式，或由项目管理员配置密钥。" } };
  if (source === "gemini") {
    const limited = geminiRateLimitError(request);
    if (limited) return limited;
    try {
      const analysis = await analyzeContractWithGemini({ text, fileName, mimeType, fileData }, { apiKey: process.env.GEMINI_API_KEY, model });
      return { status: 200, payload: analysis };
    } catch (error) {
      return publicAIError(error, "gemini");
    }
  }
  if (source === "openai") {
    try {
      const analysis = await analyzeContractWithOpenAI({ text, fileName, mimeType, fileData }, { apiKey: process.env.OPENAI_API_KEY, model });
      return { status: 200, payload: analysis };
    } catch (error) {
      return publicAIError(error, "openai");
    }
  }
  if (text) return { status: 200, payload: { ...parseContractLocally(text, { fileName }), fallbackReason: "AI_NOT_CONFIGURED" } };
  return { status: 503, payload: { error: "AI_NOT_CONFIGURED", message: "当前未配置AI合同识别。你仍然可以手动填写，或粘贴合同文字使用本地演示识别。" } };
}

async function parseItemsHandler(body, request) {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const { source, model } = aiRequestSettings(body);
  if (text.length > 500) return { status: 400, payload: { error: "TEXT_TOO_LONG", message: "自由文本不能超过 500 字。" } };
  if (!text) return { status: 200, payload: parseCarriedItems("") };
  if (source === "demo") return { status: 200, payload: parseCarriedItems(text) };
  if (source === "codex") return { status: 501, payload: { error: "CODEX_RUNTIME_UNAVAILABLE", message: "Codex桌面Agent不能作为公开网页的文本解析接口。" } };
  if (source === "gemini" && !process.env.GEMINI_API_KEY) return { status: 503, payload: { error: "AI_NOT_CONFIGURED", message: "服务器尚未配置Gemini API。" } };
  if (source === "openai" && !process.env.OPENAI_API_KEY) return { status: 503, payload: { error: "AI_NOT_CONFIGURED", message: "服务器尚未配置OpenAI API。" } };
  if (source === "gemini") {
    const limited = geminiRateLimitError(request);
    if (limited) return limited;
    try {
      const parsed = await parseItemsWithGemini(text, { apiKey: process.env.GEMINI_API_KEY, model });
      return { status: 200, payload: sanitizeParsedItems(parsed) };
    } catch (error) {
      return publicAIError(error, "gemini");
    }
  }
  if (source === "openai") {
    try {
      const parsed = await parseItemsWithOpenAI(text, { apiKey: process.env.OPENAI_API_KEY, model });
      return { status: 200, payload: sanitizeParsedItems(parsed) };
    } catch (error) {
      return publicAIError(error, "openai");
    }
  }
  return { status: 200, payload: parseCarriedItems(text) };
}

async function productGroupsFor(result) {
  const targets = candidateSearchItems(result, 5);
  const allowlist = merchantAllowlistFromEnv(process.env.PRODUCT_MERCHANT_ALLOWLIST);
  return Promise.all(targets.map(async (item) => {
    if (!process.env.SERPAPI_API_KEY) return snapshotFor(item);
    try {
      const live = await searchProducts(item, { apiKey: process.env.SERPAPI_API_KEY, allowlist });
      return live.candidates.length ? live : snapshotFor(item);
    } catch {
      return snapshotFor(item);
    }
  }));
}

async function apiHandler(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/ai-settings") {
    return sendJson(response, 200, aiSettingsPayload());
  }
  if (request.method === "POST" && url.pathname === "/api/ai-test") {
    const body = await readJson(request);
    const { source, model } = aiRequestSettings({ aiSource: body.source, aiModel: body.model });
    if (source === "demo") return sendJson(response, 200, { ok: true, provider: "演示模式", model: "local-rules" });
    if (source === "codex") return sendJson(response, 501, { error: "CODEX_RUNTIME_UNAVAILABLE", message: "Codex桌面Agent不能作为公开网页运行时。" });
    if (source === "gemini" && !process.env.GEMINI_API_KEY) return sendJson(response, 503, { error: "AI_NOT_CONFIGURED", message: "服务器尚未配置Gemini API密钥。" });
    if (source === "openai" && !process.env.OPENAI_API_KEY) return sendJson(response, 503, { error: "AI_NOT_CONFIGURED", message: "服务器尚未配置OpenAI API密钥。" });
    const limited = source === "gemini" ? geminiRateLimitError(request) : null;
    if (limited) return sendJson(response, limited.status, limited.payload);
    try {
      const result = source === "gemini"
        ? await testGeminiConnection({ apiKey: process.env.GEMINI_API_KEY, model })
        : await testOpenAIConnection(model);
      return sendJson(response, 200, result);
    }
    catch (error) {
      const result = publicAIError(error, source);
      return sendJson(response, result.status, result.payload);
    }
  }
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, {
      ok: true,
      aiProvider: preferredAISource(),
      aiModel: preferredAISource() === "gemini" ? (process.env.GEMINI_MODEL || "gemini-3.1-flash-lite") : preferredAISource() === "openai" ? (process.env.OPENAI_MODEL || "gpt-5-mini") : "local-rules",
      aiParsing: preferredAISource() === "demo" ? "local-fallback" : "configured",
      contractAnalysis: preferredAISource() === "demo" ? "local-demo" : "configured",
      aiDailyLimitPerVisitor: Math.max(1, Math.min(100, Number(process.env.GEMINI_DAILY_LIMIT) || 8)),
      productSearch: process.env.SERPAPI_API_KEY ? "configured" : "demo-snapshot",
      rules: "live"
    });
  }
  if (request.method === "POST" && url.pathname === "/api/parse-items") {
    const result = await parseItemsHandler(await readJson(request), request);
    return sendJson(response, result.status, result.payload);
  }
  if (request.method === "POST" && url.pathname === "/api/parse-contract") {
    const result = await parseContractHandler(await readJson(request), request);
    return sendJson(response, result.status, result.payload);
  }
  if (request.method === "POST" && url.pathname === "/api/recommendations") {
    const body = await readJson(request);
    try {
      const rulesResult = buildRecommendations(body);
      const productGroups = await productGroupsFor(rulesResult);
      const result = attachProducts(rulesResult, productGroups);
      const modes = new Set(productGroups.map((group) => group.factStatus));
      result.productDataMode = modes.has("live-api") ? (modes.size > 1 ? "mixed" : "live-api") : "demo-snapshot";
      return sendJson(response, 200, result);
    } catch (error) {
      if (error.code === "VALIDATION_ERROR") return sendJson(response, 400, { error: error.code, details: error.details });
      throw error;
    }
  }
  if (request.method === "POST" && url.pathname === "/api/rebudget") {
    const body = await readJson(request);
    const budget = Number(body?.budget);
    if (!body?.result || !Number.isFinite(budget) || budget < 40 || budget > 500) return sendJson(response, 400, { error: "INVALID_BUDGET" });
    return sendJson(response, 200, rebudget(body.result, budget));
  }
  return sendJson(response, 404, { error: "NOT_FOUND" });
}

async function staticHandler(response, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalized = path.normalize(requested).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(response, 403, { error: "FORBIDDEN" });
  try {
    const data = await readFile(filePath);
    const isStandalonePreview = path.basename(filePath) === "share.html";
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Security-Policy": isStandalonePreview
        ? "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        : "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(response, 404, { error: "NOT_FOUND" });
    throw error;
  }
}

export async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await apiHandler(request, response, url);
    else if (request.method === "GET" || request.method === "HEAD") await staticHandler(response, url);
    else sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    sendJson(response, error.status || 500, { error: "INTERNAL_ERROR", message: error.status ? error.message : "服务暂时不可用；规则清单仍可在浏览器本地生成。" });
  }
}

export function createServer() {
  return http.createServer(handleRequest);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  const host = process.env.HOST || "127.0.0.1";
  createServer().listen(port, host, () => {
    console.log(`UniKit MVP running at http://${host}:${port}`);
  });
}
