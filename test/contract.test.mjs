import test from "node:test";
import assert from "node:assert/strict";
import { parseContractLocally, contractAnalysisCount } from "../public/js/contract.js";
import { normalizeContractOutput } from "../adapters/contract.mjs";

test("local contract demo extracts explicit facts and leaves missing facilities unknown", () => {
  const result = parseContractLocally("Your en-suite room contains a 4ft small double bed and mattress. The shared kitchen includes an induction hob. A laundry room is available.");
  assert.equal(result.profile.roomType.value, "ensuite-small-double");
  assert.equal(result.profile.bedSize.value, "small-double");
  assert.equal(result.facilities.mattress.value, "yes");
  assert.equal(result.facilities.stovetop.value, "induction");
  assert.equal(result.facilities.laundry.value, "yes");
  assert.equal(result.facilities.microwave.value, "unknown");
  assert.ok(contractAnalysisCount(result) >= 5);
});

test("normalized AI contract output rejects unsupported values and unsupported claims without evidence", () => {
  const result = normalizeContractOutput({
    profile: {
      roomType: { value: "castle", confidence: "high", evidence: "castle" },
      bedSize: { value: "double", confidence: "high", evidence: "" }
    },
    facilities: {}
  });
  assert.equal(result.profile.roomType.value, "unknown");
  assert.equal(result.profile.bedSize.value, "unknown");
  assert.equal(result.facilities.kettle.value, "unknown");
});

test("normalized Gemini contract output keeps the provider visible for human confirmation", () => {
  const result = normalizeContractOutput({ profile: {}, facilities: {} }, { provider: "gemini", model: "gemini-3.1-flash-lite" });
  assert.equal(result.source, "gemini-contract");
  assert.equal(result.model, "gemini-3.1-flash-lite");
});

test("a contract saying a facility is not mentioned stays unknown instead of becoming present", () => {
  const result = parseContractLocally("The contract does not mention a dishwasher, vacuum cleaner or drying rack.");
  assert.equal(result.facilities.dishwasher.value, "unknown");
  assert.equal(result.facilities.vacuum.value, "unknown");
  assert.equal(result.facilities.drying.value, "unknown");
});

test("AI output cannot turn a not-mentioned statement into an explicit no", () => {
  const result = normalizeContractOutput({
    profile: {},
    facilities: {
      microwave: { value: "no", confidence: "high", evidence: "The contract does not mention a microwave." },
      kettle: { value: "no", confidence: "high", evidence: "A kettle is not provided." }
    }
  });
  assert.equal(result.facilities.microwave.value, "unknown");
  assert.equal(result.facilities.microwave.confidence, "low");
  assert.equal(result.facilities.microwave.evidence, "");
  assert.equal(result.facilities.kettle.value, "no");
});
