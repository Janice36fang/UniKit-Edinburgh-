import { FACILITY_GROUPS } from "./catalog.js?v=1.7.0";

const UNKNOWN_RECORD = Object.freeze({ value: "unknown", confidence: "low", evidence: "" });

function record(value = "unknown", evidence = "", confidence = "low") {
  return { value, evidence: String(evidence || "").trim().slice(0, 260), confidence };
}

function sentences(text) {
  return String(text || "")
    .split(/(?:\r?\n)+|(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function evidenceFor(parts, pattern) {
  return parts.find((part) => pattern.test(part)) || "";
}

function firstMatch(parts, choices) {
  for (const choice of choices) {
    const evidence = evidenceFor(parts, choice.pattern);
    if (evidence) return record(choice.value, evidence, choice.confidence || "high");
  }
  return record();
}

export function emptyContractAnalysis({ source = "local-demo", fileName = "" } = {}) {
  const facilities = Object.fromEntries(
    FACILITY_GROUPS.flatMap((group) => group.fields.map((field) => [field.id, { ...UNKNOWN_RECORD }]))
  );
  return {
    source,
    fileName,
    analyzedAt: new Date().toISOString(),
    profile: { roomType: { ...UNKNOWN_RECORD }, bedSize: { ...UNKNOWN_RECORD } },
    facilities
  };
}

export function parseContractLocally(text, { fileName = "粘贴的合同文字" } = {}) {
  const parts = sentences(text);
  const result = emptyContractAnalysis({ source: "local-demo", fileName });

  result.profile.roomType = firstMatch(parts, [
    { value: "twin-single", pattern: /\b(twin room|two single beds?)\b|双人间|双床房/i },
    { value: "studio-double", pattern: /\bstudio\b|单间公寓/i },
    { value: "shared-bath-single", pattern: /\bshared bathroom\b|公共卫浴/i },
    { value: "ensuite-small-double", pattern: /\b(en[- ]?suite|private bathroom)\b|独立卫浴/i },
    { value: "shared-single", pattern: /\b(shared flat|shared kitchen)\b|合租公寓|共享厨房/i, confidence: "medium" }
  ]);
  result.profile.bedSize = firstMatch(parts, [
    { value: "small-double", pattern: /\b(small double|4\s*ft(?:\s*bed)?|120\s*[×x]\s*190)\b|小双人床/i },
    { value: "double", pattern: /\b(double bed|4\s*ft\s*6|135\s*[×x]\s*190)\b|双人床/i },
    { value: "single", pattern: /\b(single bed|3\s*ft(?:\s*bed)?|90\s*[×x]\s*190)\b|单人床/i }
  ]);

  const facilityRules = {
    mattress: [
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?mattress\b|不提供床垫/i },
      { value: "yes", pattern: /\b(mattress (?:is )?provided|includes? (?:a )?mattress|bed and mattress)\b|提供床垫/i }
    ],
    pillow: [
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?pillow\b|\bpillows? (?:is|are) not provided\b|不提供枕头/i },
      { value: "yes", pattern: /\bpillows? (?:is|are)?\s*provided\b|提供枕头/i }
    ],
    desk_lamp: [
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?desk lamp\b|不提供台灯/i },
      { value: "yes", pattern: /\bdesk lamp (?:is )?provided\b|提供台灯/i }
    ],
    microwave: [
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?microwave\b|没有微波炉/i },
      { value: "yes", pattern: /\b(?:includes?|provided with|equipped with)[^.!?]{0,80}\bmicrowave\b|\bmicrowave (?:is )?(?:provided|included|available)\b|提供微波炉/i }
    ],
    kettle: [
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?kettle\b|没有(?:电)?热水壶/i },
      { value: "yes", pattern: /\b(?:includes?|provided with|equipped with)[^.!?]{0,80}\bkettle\b|\bkettle (?:is )?(?:provided|included|available)\b|提供(?:电)?热水壶/i }
    ],
    stovetop: [
      { value: "induction", pattern: /\b(induction hob|induction cooking rings?)\b|电磁炉/i },
      { value: "electric", pattern: /\b(electric hob|electric cooking rings?|ceramic hob)\b|普通电炉|陶瓷炉/i }
    ],
    dishwasher: [
      { value: "unknown", pattern: /\b(?:does not|doesn't|did not) mention[^.!?]*\bdishwasher\b|未提及洗碗机/i, confidence: "low" },
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?dishwasher\b|没有洗碗机/i },
      { value: "yes", pattern: /\b(?:includes?|provided with|equipped with)[^.!?]{0,80}\bdishwasher\b|\bdishwasher (?:is )?(?:provided|included|available)\b|提供洗碗机/i }
    ],
    kitchen_storage: [
      { value: "limited", pattern: /\b(limited|minimal) (?:personal )?(?:kitchen )?storage\b|厨房储物空间有限/i },
      { value: "normal", pattern: /\b(personal|individual) (?:kitchen )?(?:cupboard|storage)\b|独立厨房储物/i, confidence: "medium" }
    ],
    bathroom: [
      { value: "private", pattern: /\b(en[- ]?suite|private bathroom)\b|独立卫浴/i },
      { value: "shared", pattern: /\bshared bathroom\b|公共卫浴/i }
    ],
    bathroom_bin: [
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?bathroom bin\b|没有浴室垃圾桶/i },
      { value: "yes", pattern: /\bbathroom bin (?:is )?provided\b|提供浴室垃圾桶/i }
    ],
    bathroom_storage: [
      { value: "no", pattern: /\b(no|without)\s+bathroom storage\b|没有浴室收纳/i },
      { value: "yes", pattern: /\bbathroom (?:cabinet|storage) (?:is )?provided\b|提供浴室收纳/i }
    ],
    laundry: [
      { value: "no", pattern: /\b(no|without)\s+(?:on-site )?laundry\b|没有洗衣房/i },
      { value: "yes", pattern: /\b(laundry room|launderette|on-site laundry)\b|洗衣房/i }
    ],
    vacuum: [
      { value: "unknown", pattern: /\b(?:does not|doesn't|did not) mention[^.!?]*\bvacuum\b|未提及吸尘器/i, confidence: "low" },
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?vacuum\b|没有吸尘器/i },
      { value: "yes", pattern: /\bvacuum (?:cleaner )?(?:is )?(?:provided|available)\b|提供吸尘器/i }
    ],
    drying: [
      { value: "unknown", pattern: /\b(?:does not|doesn't|did not) mention[^.!?]*\b(drying rack|clothes airer|drying facilities)\b|未提及晾衣设施/i, confidence: "low" },
      { value: "no", pattern: /\b(no|without)\s+(?:a\s+)?drying rack\b|没有晾衣设施/i },
      { value: "yes", pattern: /\b(drying rack|clothes airer|drying facilities)\b|晾衣设施/i }
    ]
  };

  for (const [fieldId, choices] of Object.entries(facilityRules)) {
    result.facilities[fieldId] = firstMatch(parts, choices);
  }
  return result;
}

export function contractAnalysisCount(analysis) {
  if (!analysis) return 0;
  const records = [analysis.profile?.roomType, analysis.profile?.bedSize, ...Object.values(analysis.facilities || {})];
  return records.filter((item) => item?.value && item.value !== "unknown").length;
}
