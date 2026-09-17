import test from "node:test";
import assert from "node:assert/strict";
import { attachProducts, buildRecommendations, calculateLuggageBands, defaultFacilities, parseCarriedItems, rebudget, validateProfile } from "../public/js/engine.js";
import { shoppingLinksFor } from "../public/js/catalog.js";
import { normalizeSerpResults } from "../adapters/serpapi.mjs";

const baseProfile = (overrides = {}) => ({
  roomType: "ensuite-small-double",
  bedSize: "small-double",
  moveIn: "within-7",
  budget: 180,
  cooking: "sometimes",
  location: "china",
  preparedFittedSheet: "no",
  preparedFlatSheet: "no",
  preparedPillow: "no",
  preparedPillowcase: "no",
  preparedDomestic: [],
  luggagePreset: "2x23",
  checkedBagCount: 2,
  checkedBagKg: 23,
  carryOnCount: 1,
  luggageSpace: "medium",
  guestCount: "none",
  carriedText: "转换插头、洗漱用品、一条薄毯子",
  ...overrides
});

function makeResult(profileOverrides = {}, facilityOverrides = {}, carriedText) {
  const profile = baseProfile(profileOverrides);
  if (carriedText !== undefined) profile.carriedText = carriedText;
  return buildRecommendations({
    profile,
    facilities: { ...defaultFacilities(), ...facilityOverrides },
    parsedCarried: parseCarriedItems(profile.carriedText)
  });
}

test("profile requires all decision-changing fields", () => {
  const result = validateProfile({});
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["bedSize", "beddingPreparation", "budget", "cooking", "guestCount", "location", "luggageAllowance", "luggageSpace", "moveIn", "roomType"].sort());
});

test("2x23kg allowance is expressed as meaningful shares of all checked luggage", () => {
  const plan = calculateLuggageBands({ checkedBagCount: 2, checkedBagKg: 23, carryOnCount: 1 });
  assert.equal(plan.checkedTotalKg, 46);
  assert.equal(plan.quarterKg, 11.5);
  assert.equal(plan.halfKg, 23);
  assert.equal(plan.threeQuarterKg, 34.5);
  assert.equal(plan.fullKg, 46);
  assert.match(plan.options.tight.title, /半个箱子—1个箱子/);
  assert.match(plan.options.medium.detail, /23—34.5kg/);
});

test("1x23kg allowance uses the same luggage-share model without a 0-5kg band", () => {
  const plan = calculateLuggageBands({ checkedBagCount: 1, checkedBagKg: 23, carryOnCount: 1 });
  assert.equal(plan.checkedTotalKg, 23);
  assert.equal(plan.quarterKg, 6);
  assert.equal(plan.halfKg, 11.5);
  assert.equal(plan.threeQuarterKg, 17.5);
  assert.match(plan.options.tight.title, /1\/4个箱子—半个箱子/);
  assert.doesNotMatch(plan.options.tight.title, /0—5kg/);
});

test("2x20kg allowance converts total-luggage shares to 10-20-30-40kg", () => {
  const plan = calculateLuggageBands({ checkedBagCount: 2, checkedBagKg: 20, carryOnCount: 1 });
  assert.equal(plan.checkedTotalKg, 40);
  assert.equal(plan.quarterKg, 10);
  assert.equal(plan.halfKg, 20);
  assert.equal(plan.threeQuarterKg, 30);
  assert.equal(plan.fullKg, 40);
});

test("shopping references produce encoded UK retailer search links", () => {
  const links = shoppingLinksFor({ category: "床品", query: "small double Duvet 10.5 tog" });
  assert.deepEqual(links.map((link) => link.label), ["Google Shopping", "Dunelm", "Argos"]);
  assert.match(links[0].url, /google\.co\.uk/);
  assert.match(links[1].url, /small%20double%20Duvet%2010\.5%20tog/);
  assert.match(links[2].url, /small-double-duvet-10-5-tog/);
});

test("default scenario returns 15-20 category items and stays in budget", () => {
  const result = makeResult();
  assert.ok(result.items.length >= 15 && result.items.length <= 20);
  assert.ok(result.spendGbp <= result.budgetGbp);
  assert.equal(result.budgetStatus, "within-budget");
});

test("lowering budget recalculates deterministically and reports differences", () => {
  const initial = makeResult({ budget: 180 });
  const reduced = rebudget(initial, 150);
  assert.ok(reduced.spendGbp <= 150);
  assert.ok(reduced.diff.removedItems.length > 0);
  assert.ok(reduced.diff.savingsGbp > 0);
});

test("complete bedding removes equivalent bedding categories", () => {
  const result = makeResult({}, {}, "我带了完整床品四件套");
  const ids = new Set(result.items.map((item) => item.itemId));
  assert.equal(ids.has("bedding_duvet"), false);
  assert.equal(ids.has("bedding_fitted_sheet"), false);
  assert.equal(ids.has("bedding_pillowcase"), false);
});

test("a thin blanket never removes the duvet", () => {
  const result = makeResult({}, {}, "只带了一条薄毯子");
  assert.ok(result.items.some((item) => item.itemId === "bedding_duvet"));
  assert.equal(result.parsedCarried.ambiguous[0].itemId, "thin_blanket");
});

test("explicit Single bed size generates a Single bedding query", () => {
  const result = makeResult({ roomType: "ensuite-small-double", bedSize: "single" });
  assert.match(result.items.find((item) => item.itemId === "bedding_duvet").ukProductName, /^single /i);
});

test("unknown bed size places size-dependent bedding into verification", () => {
  const result = makeResult({ bedSize: "unknown" });
  assert.equal(result.items.find((item) => item.itemId === "bedding_duvet").state, "verify");
  assert.ok(result.warnings.some((warning) => warning.includes("床型待核实")));
});

test("a prepared fitted sheet or flat sheet removes the fitted-sheet purchase", () => {
  const fitted = makeResult({ preparedFittedSheet: "yes" });
  const flat = makeResult({ preparedFlatSheet: "yes" });
  assert.equal(fitted.items.some((item) => item.itemId === "bedding_fitted_sheet"), false);
  assert.equal(flat.items.some((item) => item.itemId === "bedding_fitted_sheet"), false);
});

test("prepared pillow and pillowcase are removed independently", () => {
  const result = makeResult({ preparedPillow: "yes", preparedPillowcase: "yes" });
  assert.equal(result.items.some((item) => item.itemId === "bedding_pillow"), false);
  assert.equal(result.items.some((item) => item.itemId === "bedding_pillowcase"), false);
});

test("uncertain bedding preparation is verified before purchase", () => {
  const result = makeResult({ preparedPillowcase: "unknown" });
  const pillowcase = result.items.find((item) => item.itemId === "bedding_pillowcase");
  assert.equal(pillowcase.state, "verify");
  assert.equal(pillowcase.buyStage, "出发前核实");
  assert.equal(pillowcase.budgetSubtotalGbp, 0);
});

test("image checklist selections de-duplicate exact catalog matches", () => {
  const result = makeResult({ preparedDomestic: ["dinnerware_set", "hangers", "bin_bags"] });
  const ids = new Set(result.items.map((item) => item.itemId));
  assert.equal(ids.has("kitchen_cutlery"), false);
  assert.equal(ids.has("kitchen_bowl_mug"), false);
  assert.equal(ids.has("living_hangers"), false);
  assert.equal(ids.has("clean_bin_bags"), false);
});

test("provided pillow is excluded", () => {
  const result = makeResult({}, { pillow: "yes" });
  assert.equal(result.items.some((item) => item.itemId === "bedding_pillow"), false);
});

test("unknown kettle is not counted as an immediate purchase", () => {
  const result = makeResult({}, { kettle: "unknown" });
  const kettle = result.items.find((item) => item.itemId === "kitchen_kettle");
  assert.equal(kettle.state, "verify");
  assert.equal(kettle.budgetSubtotalGbp, 0);
});

test("induction hob changes cookware queries and warnings", () => {
  const result = makeResult({}, { stovetop: "induction" });
  const pan = result.items.find((item) => item.itemId === "kitchen_frying_pan");
  assert.match(pan.ukProductName, /induction compatible/i);
  assert.match(pan.specWarning, /induction compatible/i);
});

test("rare cooking removes pans and saucepan", () => {
  const result = makeResult({ cooking: "rarely" });
  assert.equal(result.items.some((item) => item.itemId === "kitchen_frying_pan"), false);
  assert.equal(result.items.some((item) => item.itemId === "kitchen_saucepan"), false);
});

test("daily cooking keeps basic cookware", () => {
  const result = makeResult({ cooking: "daily" });
  assert.ok(result.items.some((item) => item.itemId === "kitchen_frying_pan"));
  assert.ok(result.items.some((item) => item.itemId === "kitchen_saucepan"));
});

test("users already in the UK receive no domestic-carry next steps", () => {
  const result = makeResult({ location: "uk" }, {}, "");
  assert.equal(result.items.some((item) => item.buyStage === "国内带"), false);
});

test("medium luggage assigns compact preferred items to domestic carry", () => {
  const result = makeResult({ location: "china", luggageSpace: "medium" }, {}, "");
  assert.equal(result.items.find((item) => item.itemId === "electric_adapter").buyStage, "国内带");
  assert.equal(result.items.find((item) => item.itemId === "bath_towel").buyStage, "国内带");
});

test("tight luggage moves a bulky towel to UK purchase", () => {
  const result = makeResult({ location: "china", luggageSpace: "tight" }, {}, "");
  assert.equal(result.items.find((item) => item.itemId === "bath_towel").buyStage, "英国买");
  assert.equal(result.items.find((item) => item.itemId === "electric_adapter").buyStage, "国内带");
});

test("unknown packing space uses the conservative domestic-carry rule", () => {
  const result = makeResult({ location: "china", luggageSpace: "unknown" }, {}, "");
  assert.equal(result.items.find((item) => item.itemId === "electric_adapter").buyStage, "国内带");
  assert.equal(result.items.some((item) => item.itemId === "living_slippers" && item.buyStage === "国内带"), false);
});

test("roomy luggage can carry optional compact items", () => {
  const result = makeResult({ location: "china", luggageSpace: "roomy" }, {}, "");
  assert.equal(result.items.find((item) => item.itemId === "kitchen_cutlery").buyStage, "国内带");
});

test("guest count changes tableware quantity independently of cooking", () => {
  const result = makeResult({ cooking: "rarely", guestCount: "three-plus", budget: 250 }, {}, "");
  assert.equal(result.items.find((item) => item.itemId === "kitchen_bowl_mug").quantity, 4);
  assert.equal(result.items.find((item) => item.itemId === "kitchen_cutlery").quantity, 4);
});

test("dishwasher adds a machine-washable specification note", () => {
  const result = makeResult({}, { dishwasher: "yes" }, "");
  assert.match(result.items.find((item) => item.itemId === "kitchen_bowl_mug").specWarning, /可机洗/);
});

test("limited kitchen storage changes cookware explanation", () => {
  const result = makeResult({}, { kitchen_storage: "limited" }, "");
  assert.match(result.items.find((item) => item.itemId === "kitchen_frying_pan").reason, /储物有限/);
});

test("budget below UK P0 cost is reported instead of deleting essentials", () => {
  const result = makeResult({ budget: 40, location: "uk", guestCount: "three-plus" }, {}, "");
  assert.equal(result.budgetStatus, "insufficient");
  assert.ok(result.shortfallGbp > 0);
  assert.ok(result.items.filter((item) => item.priority === "P0" && item.state === "current").length > 0);
});

test("bilingual duplicate possessions normalize to one item", () => {
  const parsed = parseCarriedItems("转换插头, travel adapter");
  assert.equal(parsed.items.filter((item) => item.itemId === "electric_adapter").length, 1);
});

test("product normalization enforces merchant allowlist and de-duplicates SKU", () => {
  const payload = { shopping_results: [
    { product_id: "1", title: "Induction Pan", extracted_price: 15, source: "Argos", product_link: "https://example.com/1" },
    { product_id: "1", title: "Induction Pan Duplicate", extracted_price: 15, source: "Argos", product_link: "https://example.com/2" },
    { product_id: "2", title: "Induction Pan", extracted_price: 12, source: "Unknown shop" }
  ] };
  const result = normalizeSerpResults(payload, { query: "pan", allowlist: ["Argos"], requiredTerms: ["induction"] });
  assert.equal(result.length, 1);
  assert.equal(result[0].externalId, "1");
});

test("product normalization rejects incompatible cookware", () => {
  const payload = { shopping_results: [
    { product_id: "1", title: "Aluminium Frying Pan", extracted_price: 8, source: "Argos" },
    { product_id: "2", title: "Induction Frying Pan", extracted_price: 15, source: "Argos" }
  ] };
  const result = normalizeSerpResults(payload, { query: "pan", allowlist: ["Argos"], requiredTerms: ["induction"] });
  assert.deepEqual(result.map((item) => item.externalId), ["2"]);
});

test("product normalization can reject a conflicting bed size", () => {
  const payload = { shopping_results: [
    { product_id: "small", title: "Small Double Fitted Sheet", extracted_price: 9, source: "Argos" },
    { product_id: "double", title: "Double Fitted Sheet", extracted_price: 11, source: "Argos" }
  ] };
  const result = normalizeSerpResults(payload, { query: "double fitted sheet", allowlist: ["Argos"], requiredTerms: ["double"], forbiddenTerms: ["small double"] });
  assert.deepEqual(result.map((item) => item.externalId), ["double"]);
});

test("live API candidate price replaces the rule reference and recalculates budget", () => {
  const result = makeResult({ budget: 250 }, {}, "");
  const before = result.baseItems.find((item) => item.itemId === "bedding_duvet");
  const updated = attachProducts(result, [{
    itemId: "bedding_duvet",
    factStatus: "live-api",
    fetchedAt: "2026-09-16T12:00:00.000Z",
    candidates: [{ externalId: "sku-live", title: "Live duvet", priceGbp: 31, merchant: "Argos", fetchedAt: "2026-09-16T12:00:00.000Z" }]
  }]);
  const after = updated.baseItems.find((item) => item.itemId === "bedding_duvet");
  assert.equal(before.unitPriceGbp, 22);
  assert.equal(after.unitPriceGbp, 31);
  assert.equal(after.priceType, "live-api");
  assert.ok(updated.spendGbp > result.spendGbp);
});

test("demo snapshot never replaces the rule budget price", () => {
  const result = makeResult({ budget: 250 }, {}, "");
  const updated = attachProducts(result, [{ itemId: "bedding_duvet", factStatus: "demo-snapshot", candidates: [{ externalId: "demo", priceGbp: 99 }] }]);
  assert.equal(updated.baseItems.find((item) => item.itemId === "bedding_duvet").unitPriceGbp, 22);
});
