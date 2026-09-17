import { FACILITY_GROUPS } from "../public/js/catalog.js";

const PROFILE_FIELDS = {
  roomType: ["ensuite-small-double", "studio-double", "shared-single", "shared-bath-single", "twin-single", "unknown"],
  bedSize: ["single", "small-double", "double", "unknown"]
};
const CONFIDENCE = ["high", "medium", "low"];

function recordSchema(values) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      value: { type: "string", enum: values },
      confidence: { type: "string", enum: CONFIDENCE },
      evidence: { type: "string", maxLength: 260 }
    },
    required: ["value", "confidence", "evidence"]
  };
}

const facilityProperties = Object.fromEntries(
  FACILITY_GROUPS.flatMap((group) => group.fields.map((field) => [field.id, recordSchema(field.options.map(([value]) => value))]))
);

const CONTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([key, values]) => [key, recordSchema(values)])),
      required: Object.keys(PROFILE_FIELDS)
    },
    facilities: {
      type: "object",
      additionalProperties: false,
      properties: facilityProperties,
      required: Object.keys(facilityProperties)
    }
  },
  required: ["profile", "facilities"]
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

function evidenceMeansUnknown(evidence) {
  if (!evidence) return false;
  return [
    /\b(?:does not|doesn't|did not|is not|isn't|was not|wasn't)\s+(?:mention|state|specify|indicate|say|list)\b/i,
    /\bnot\s+(?:mentioned|stated|specified|indicated|listed)\b/i,
    /(?:未|没有)(?:提及|说明|注明|写明|列出|显示)|不确定/
  ].some((pattern) => pattern.test(evidence));
}

function normalizeRecord(input, allowedValues) {
  const evidence = typeof input?.evidence === "string" ? input.evidence.trim().slice(0, 260) : "";
  const requested = allowedValues.includes(input?.value) ? input.value : "unknown";
  const missingFact = evidenceMeansUnknown(evidence);
  const value = requested !== "unknown" && (!evidence || missingFact) ? "unknown" : requested;
  return {
    value,
    confidence: value === "unknown" ? "low" : CONFIDENCE.includes(input?.confidence) ? input.confidence : "low",
    evidence: missingFact ? "" : evidence
  };
}

function normalizeContractOutput(data, { fileName = "住宿合同", model = "", provider = "openai" } = {}) {
  const profile = Object.fromEntries(
    Object.entries(PROFILE_FIELDS).map(([key, values]) => [key, normalizeRecord(data?.profile?.[key], values)])
  );
  const facilities = Object.fromEntries(
    FACILITY_GROUPS.flatMap((group) => group.fields.map((field) => [
      field.id,
      normalizeRecord(data?.facilities?.[field.id], field.options.map(([value]) => value))
    ]))
  );
  const safeProvider = provider === "gemini" ? "gemini" : "openai";
  return { source: `${safeProvider}-contract`, model, fileName, analyzedAt: new Date().toISOString(), profile, facilities };
}

function contractContent({ text, fileName, mimeType, fileData }) {
  const content = [{
    type: "input_text",
    text: [
      "Extract accommodation facts from the supplied contract for a student shopping planner.",
      "Use only facts explicitly present in the material. Never infer a facility from room type or common practice.",
      "For every missing or unclear field return value 'unknown', confidence 'low', and an empty evidence string.",
      "For a non-unknown value, evidence must be a short verbatim excerpt from the material.",
      "Map 3ft or 90x190cm to single, 4ft or 120x190cm to small-double, and 4ft6 or 135x190cm to double.",
      "Return only data matching the supplied schema.",
      text ? `Additional pasted text:\n${text}` : ""
    ].filter(Boolean).join("\n")
  }];
  if (fileData) {
    if (String(mimeType).startsWith("image/")) content.unshift({ type: "input_image", image_url: fileData, detail: "high" });
    else content.unshift({ type: "input_file", filename: fileName || "accommodation-contract.pdf", file_data: fileData, detail: "high" });
  }
  return content;
}

export async function analyzeContractWithOpenAI(input, { apiKey, model = "gpt-5-mini", timeoutMs = 30000 } = {}) {
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      store: false,
      input: [{ role: "user", content: contractContent(input) }],
      text: { format: { type: "json_schema", name: "accommodation_contract", strict: true, schema: CONTRACT_SCHEMA } }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`OpenAI contract request failed with ${response.status}`);
    error.code = "UPSTREAM_ERROR";
    error.status = response.status;
    error.upstreamCode = payload?.error?.code || payload?.error?.type || "UPSTREAM_ERROR";
    throw error;
  }
  return normalizeContractOutput(JSON.parse(outputText(payload)), { fileName: input.fileName, model: payload.model || model });
}

export { CONTRACT_SCHEMA, normalizeContractOutput };
