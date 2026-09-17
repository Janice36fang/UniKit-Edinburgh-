import { CATALOG, ITEM_INDEX } from "../public/js/catalog.js";

const ALLOWED_IDS = [...CATALOG.map((item) => item.id), "bedding_set", "thin_blanket"];

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item_id: { type: "string", enum: ALLOWED_IDS },
          matched_text: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          ambiguous: { type: "boolean" }
        },
        required: ["item_id", "matched_text", "confidence", "ambiguous"]
      }
    },
    unmatched: { type: "array", items: { type: "string" }, maxItems: 8 }
  },
  required: ["items", "unmatched"]
};

function outputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function normalizeModelOutput(data, source = "openai") {
  const items = [];
  const ambiguous = [];
  for (const record of Array.isArray(data?.items) ? data.items : []) {
    if (!ALLOWED_IDS.includes(record.item_id)) continue;
    const target = record.ambiguous || record.item_id === "thin_blanket" ? ambiguous : items;
    target.push({
      itemId: record.item_id,
      matchedText: String(record.matched_text || "").slice(0, 100),
      confidence: Number(record.confidence) || 0,
      label: ITEM_INDEX[record.item_id]?.zh || (record.item_id === "thin_blanket" ? "薄毯子（不能确认等同冬季被芯）" : "完整床品"),
      expands: record.item_id === "bedding_set" ? ["bedding_duvet", "bedding_fitted_sheet", "bedding_pillowcase"] : []
    });
  }
  return {
    items: [...new Map(items.map((item) => [item.itemId, item])).values()],
    ambiguous: [...new Map(ambiguous.map((item) => [item.itemId, item])).values()],
    unmatched: Array.isArray(data?.unmatched) ? data.unmatched.map(String).slice(0, 8) : [],
    source
  };
}

async function requestOnce(text, { apiKey, model, strictRetry = false, timeoutMs = 12000 }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      store: false,
      instructions: [
        "Extract only possessions explicitly stated by the user.",
        "Map Chinese and English synonyms to the allowed item_id values.",
        "A thin blanket or throw is thin_blanket and ambiguous; it never proves the user has a winter duvet.",
        "Do not infer unmentioned possessions.",
        strictRetry ? "Return only the JSON object matching the schema. Do not add prose." : "Use the supplied JSON schema."
      ].join(" "),
      input: text,
      text: { format: { type: "json_schema", name: "carried_items", strict: true, schema: OUTPUT_SCHEMA } }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`OpenAI request failed with ${response.status}`);
    error.code = "UPSTREAM_ERROR";
    error.status = response.status;
    error.upstreamCode = payload?.error?.code || payload?.error?.type || "UPSTREAM_ERROR";
    throw error;
  }
  return normalizeModelOutput(JSON.parse(outputText(payload)));
}

export async function parseItemsWithOpenAI(text, { apiKey, model = "gpt-5-mini" } = {}) {
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestOnce(text, { apiKey, model, strictRetry: attempt === 1 });
    } catch (error) {
      lastError = error;
      if (error.code === "UPSTREAM_ERROR") break;
    }
  }
  throw lastError;
}

export { OUTPUT_SCHEMA as ITEMS_OUTPUT_SCHEMA, normalizeModelOutput };
