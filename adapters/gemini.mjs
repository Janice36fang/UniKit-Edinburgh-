import { CONTRACT_SCHEMA, normalizeContractOutput } from "./contract.mjs";
import { ITEMS_OUTPUT_SCHEMA, normalizeModelOutput } from "./openai.mjs";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function responseText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part?.text === "string" ? part.text : "")
    .join("")
    .trim();
}

function geminiError(response, payload, fallbackCode = "GEMINI_REQUEST_FAILED") {
  const error = new Error(payload?.error?.message || `Gemini request failed with ${response.status}`);
  error.code = "UPSTREAM_ERROR";
  error.status = response.status;
  error.provider = "gemini";
  error.upstreamCode = payload?.error?.status || payload?.error?.code || fallbackCode;
  return error;
}

function filePart(fileData, expectedMimeType) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/s.exec(String(fileData || ""));
  if (!match) {
    const error = new Error("Unsupported or malformed uploaded file");
    error.code = "INVALID_FILE_DATA";
    throw error;
  }
  const mimeType = match[1].toLowerCase();
  if (expectedMimeType && mimeType !== String(expectedMimeType).toLowerCase()) {
    const error = new Error("Uploaded file type does not match its content");
    error.code = "INVALID_FILE_DATA";
    throw error;
  }
  return { inlineData: { mimeType, data: match[2].replace(/\s+/g, "") } };
}

async function requestGemini({ apiKey, model, parts, schema, timeoutMs = 30000 }) {
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.code = "NOT_CONFIGURED";
    error.provider = "gemini";
    throw error;
  }
  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: JSON.parse(JSON.stringify(schema, (key, value) => key === "maxLength" ? undefined : value))
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw geminiError(response, payload);
  const text = responseText(payload);
  if (!text) {
    const error = new Error("Gemini returned no structured output");
    error.code = "EMPTY_AI_RESPONSE";
    error.provider = "gemini";
    throw error;
  }
  try {
    return { data: JSON.parse(text), model: payload?.modelVersion || model };
  } catch {
    const error = new Error("Gemini returned invalid JSON");
    error.code = "INVALID_AI_RESPONSE";
    error.provider = "gemini";
    throw error;
  }
}

function contractPrompt(text, fileName) {
  return [
    "Extract accommodation facts from this student accommodation contract for a shopping planner.",
    "Use only facts explicitly present in the supplied material. Never infer a facility from room type, common practice, or outside knowledge.",
    "For every missing, contradictory, or unclear field return value 'unknown', confidence 'low', and an empty evidence string.",
    "For every non-unknown value, evidence must be a short verbatim excerpt from the supplied material.",
    "Map 3ft or 90x190cm to single, 4ft or 120x190cm to small-double, and 4ft6 or 135x190cm to double.",
    "Return only the JSON object matching the provided schema.",
    `File name: ${fileName || "accommodation-contract"}`,
    text ? `Additional pasted text:\n${text}` : ""
  ].filter(Boolean).join("\n");
}

export async function analyzeContractWithGemini(input, { apiKey, model = "gemini-3.1-flash-lite", timeoutMs = 30000 } = {}) {
  const parts = [{ text: contractPrompt(input.text, input.fileName) }];
  if (input.fileData) parts.unshift(filePart(input.fileData, input.mimeType));
  const result = await requestGemini({ apiKey, model, parts, schema: CONTRACT_SCHEMA, timeoutMs });
  return normalizeContractOutput(result.data, { fileName: input.fileName, model: result.model, provider: "gemini" });
}

export async function parseItemsWithGemini(text, { apiKey, model = "gemini-3.1-flash-lite", timeoutMs = 15000 } = {}) {
  const prompt = [
    "Extract only possessions explicitly stated by the user.",
    "Map Chinese and English synonyms to the allowed item_id values in the JSON schema.",
    "A thin blanket or throw is thin_blanket and ambiguous; it never proves the user has a winter duvet.",
    "Do not infer unmentioned possessions. Return only schema-compliant JSON.",
    `User text: ${text}`
  ].join("\n");
  const result = await requestGemini({ apiKey, model, parts: [{ text: prompt }], schema: ITEMS_OUTPUT_SCHEMA, timeoutMs });
  return normalizeModelOutput(result.data, "gemini");
}

export async function testGeminiConnection({ apiKey, model = "gemini-3.1-flash-lite", timeoutMs = 20000 } = {}) {
  const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with OK only." }] }], generationConfig: { maxOutputTokens: 8, temperature: 0 } })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw geminiError(response, payload, "GEMINI_TEST_FAILED");
  return { ok: true, provider: "Google Gemini API", model: payload?.modelVersion || model };
}
