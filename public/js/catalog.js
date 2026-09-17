export const FACILITY_GROUPS = [
  {
    id: "bedroom",
    label: "卧室",
    icon: "床",
    fields: [
      { id: "mattress", label: "床垫", options: [["yes", "有"], ["no", "没有"], ["unknown", "不确定"]], defaultValue: "yes" },
      { id: "pillow", label: "枕头", options: [["no", "没有"], ["yes", "有"], ["unknown", "不确定"]], defaultValue: "no" },
      { id: "desk_lamp", label: "台灯", options: [["unknown", "不确定"], ["yes", "有"], ["no", "没有"]], defaultValue: "unknown" }
    ]
  },
  {
    id: "kitchen",
    label: "厨房",
    icon: "锅",
    fields: [
      { id: "microwave", label: "微波炉", options: [["yes", "有"], ["no", "没有"], ["unknown", "不确定"]], defaultValue: "yes" },
      { id: "kettle", label: "电热水壶", options: [["yes", "有"], ["no", "没有"], ["unknown", "不确定"]], defaultValue: "yes" },
      { id: "stovetop", label: "炉灶类型", options: [["induction", "电磁炉"], ["electric", "普通电炉"], ["unknown", "不确定"]], defaultValue: "induction" },
      { id: "dishwasher", label: "洗碗机", options: [["unknown", "不确定"], ["yes", "有"], ["no", "没有"]], defaultValue: "unknown" },
      { id: "kitchen_storage", label: "个人厨房储物", options: [["unknown", "不确定"], ["limited", "很有限"], ["normal", "一般 / 充足"]], defaultValue: "unknown" }
    ]
  },
  {
    id: "bathroom",
    label: "卫浴",
    icon: "浴",
    fields: [
      { id: "bathroom", label: "卫浴类型", options: [["private", "独立卫浴"], ["shared", "公共卫浴"], ["unknown", "不确定"]], defaultValue: "private" },
      { id: "bathroom_bin", label: "浴室垃圾桶", options: [["no", "没有"], ["yes", "有"], ["unknown", "不确定"]], defaultValue: "no" },
      { id: "bathroom_storage", label: "浴室收纳", options: [["no", "没有"], ["yes", "有"], ["unknown", "不确定"]], defaultValue: "no" }
    ]
  },
  {
    id: "shared",
    label: "公共设施",
    icon: "舍",
    fields: [
      { id: "laundry", label: "洗衣房", options: [["yes", "有"], ["no", "没有"], ["unknown", "不确定"]], defaultValue: "yes" },
      { id: "vacuum", label: "吸尘器", options: [["unknown", "不确定"], ["yes", "有"], ["no", "没有"]], defaultValue: "unknown" },
      { id: "drying", label: "晾衣设施", options: [["no", "没有"], ["yes", "有"], ["unknown", "不确定"]], defaultValue: "no" }
    ]
  }
];

export const CATALOG = [
  { id: "bedding_duvet", zh: "被芯", en: "Duvet", category: "床品", priority: "P0", price: 22, bedDependent: true, searchRisk: 3, spec: "bed_size,tog" },
  { id: "bedding_fitted_sheet", zh: "床笠", en: "Fitted sheet", category: "床品", priority: "P0", price: 9, bedDependent: true, searchRisk: 2, spec: "bed_size" },
  { id: "bedding_pillow", zh: "枕头", en: "Pillow", category: "床品", priority: "P0", price: 8, providedBy: "pillow", searchRisk: 0 },
  { id: "bedding_pillowcase", zh: "枕套", en: "Pillowcase", category: "床品", priority: "P0", price: 4, bedDependent: false, carryMode: "optional-domestic", carryBulk: 1, searchRisk: 0 },
  { id: "bedding_mattress_protector", zh: "床垫保护套", en: "Mattress protector", category: "床品", priority: "P1", price: 12, bedDependent: true, searchRisk: 2, spec: "bed_size" },
  { id: "bath_towel", zh: "浴巾", en: "Bath towel", category: "卫浴", priority: "P0", price: 7, carryMode: "prefer-domestic", carryBulk: 2, searchRisk: 0 },
  { id: "toiletries", zh: "常用洗漱用品", en: "Essential toiletries", category: "卫浴", priority: "P0", price: 9, carryMode: "prefer-domestic", carryBulk: 1, searchRisk: 0 },
  { id: "electric_extension", zh: "英标插线板", en: "UK extension lead", category: "电器", priority: "P0", price: 12, searchRisk: 3, spec: "uk_plug" },
  { id: "electric_adapter", zh: "英标转换插头", en: "UK travel adaptor", category: "电器", priority: "P0", price: 8, carryMode: "prefer-domestic", carryBulk: 1, searchRisk: 2, spec: "uk_plug,voltage" },
  { id: "clean_laundry_detergent", zh: "洗衣液", en: "Laundry detergent", category: "清洁", priority: "P0", price: 5, searchRisk: 0 },
  { id: "kitchen_cutlery", zh: "基础餐具", en: "Cutlery set", category: "厨房", priority: "P1", price: 5, carryMode: "optional-domestic", carryBulk: 1, quantityByGuests: { none: 1, "one-two": 2, "three-plus": 4 }, searchRisk: 0 },
  { id: "kitchen_bowl_mug", zh: "碗杯组合", en: "Bowl and mug set", category: "厨房", priority: "P0", price: 6, quantityByGuests: { none: 1, "one-two": 2, "three-plus": 4 }, searchRisk: 0 },
  { id: "kitchen_kettle", zh: "电热水壶", en: "Electric kettle", category: "厨房", priority: "P1", price: 16, providedBy: "kettle", onlyWhenFacilityMissing: true, searchRisk: 2, spec: "uk_plug,voltage" },
  { id: "kitchen_frying_pan", zh: "煎锅", en: "Frying pan", category: "厨房", priority: "P1", price: 15, cooking: ["sometimes", "daily"], stovetopDependent: true, searchRisk: 3, spec: "hob_compatibility" },
  { id: "kitchen_saucepan", zh: "小汤锅", en: "Saucepan", category: "厨房", priority: "P1", price: 14, cooking: ["sometimes", "daily"], stovetopDependent: true, searchRisk: 3, spec: "hob_compatibility" },
  { id: "clean_dish_soap", zh: "洗洁精", en: "Washing-up liquid", category: "清洁", priority: "P1", price: 2.5, cooking: ["sometimes", "daily"], searchRisk: 0 },
  { id: "clean_sponges", zh: "清洁海绵", en: "Cleaning sponges", category: "清洁", priority: "P1", price: 3, carryMode: "optional-domestic", carryBulk: 1, searchRisk: 0 },
  { id: "clean_bin_bags", zh: "垃圾袋", en: "Bin bags", category: "清洁", priority: "P1", price: 3, searchRisk: 0 },
  { id: "living_hangers", zh: "衣架", en: "Clothes hangers", category: "生活", priority: "P1", price: 5, quantityByCooking: null, searchRisk: 0 },
  { id: "bath_shower_caddy", zh: "便携洗漱篮", en: "Shower caddy", category: "卫浴", priority: "P1", price: 8, bathroom: "shared", searchRisk: 1 },
  { id: "bathroom_bin", zh: "浴室垃圾桶", en: "Bathroom bin", category: "卫浴", priority: "P2", price: 6, providedBy: "bathroom_bin", onlyWhenFacilityMissing: true, searchRisk: 0 },
  { id: "living_drying_rack", zh: "折叠晾衣架", en: "Folding drying rack", category: "生活", priority: "P2", price: 18, providedBy: "drying", onlyWhenFacilityMissing: true, searchRisk: 2 },
  { id: "living_desk_lamp", zh: "桌面台灯", en: "Desk lamp", category: "生活", priority: "P2", price: 14, providedBy: "desk_lamp", onlyWhenFacilityMissing: true, searchRisk: 1, spec: "uk_plug,voltage" },
  { id: "living_slippers", zh: "宿舍拖鞋", en: "Indoor slippers", category: "生活", priority: "P2", price: 6, carryMode: "prefer-domestic", carryBulk: 1, searchRisk: 0 },
  { id: "bath_storage", zh: "浴室收纳盒", en: "Bathroom storage basket", category: "卫浴", priority: "P2", price: 9, providedBy: "bathroom_storage", onlyWhenFacilityMissing: true, searchRisk: 0 }
];

export const ITEM_INDEX = Object.fromEntries(CATALOG.map((item) => [item.id, item]));

export const ROOM_TYPES = {
  "ensuite-small-double": { room: "En-suite", bed: "Small Double", query: "small double" },
  "studio-double": { room: "Studio", bed: "Double", query: "double" },
  "shared-single": { room: "Shared flat", bed: "Single", query: "single" },
  "shared-bath-single": { room: "Shared bathroom", bed: "Single", query: "single" },
  "twin-single": { room: "Twin room", bed: "Single", query: "single" },
  unknown: { room: "待核实", bed: "待核实", query: "" }
};

export const BED_SIZES = {
  single: { label: "Single", dimensions: "约 90 × 190cm", query: "single" },
  "small-double": { label: "Small Double", dimensions: "约 120 × 190cm", query: "small double" },
  double: { label: "Double", dimensions: "约 135 × 190cm", query: "double" },
  unknown: { label: "待核实", dimensions: "以住宿合同为准", query: "" }
};

export const DOMESTIC_PREP_ITEMS = [
  { id: "nail_clipper", label: "指甲刀" },
  { id: "peeler", label: "削皮刀" },
  { id: "projector", label: "投影仪" },
  { id: "shopping_bags", label: "购物袋" },
  { id: "phone_dry_bag", label: "手机防水袋" },
  { id: "sewing_kit", label: "针线盒" },
  { id: "tape_measure", label: "卷尺" },
  { id: "elastic_band", label: "皮筋" },
  { id: "rice_cooker", label: "电饭煲 / 压力锅" },
  { id: "kettle", label: "烧水壶", catalogItemIds: ["kitchen_kettle"] },
  { id: "filter_cartridge", label: "过滤花洒", remark: "先核对宿舍接口型号" },
  { id: "water_filter", label: "滤水器" },
  { id: "portable_cup", label: "便携式榨汁杯" },
  { id: "phone_stand", label: "手机支架" },
  { id: "filter_balls", label: "过滤花洒滤料" },
  { id: "cleaning_rags", label: "抹布" },
  { id: "water_cup", label: "水杯" },
  { id: "adhesive_hooks", label: "粘钩" },
  { id: "seasoning", label: "调味料" },
  { id: "dinnerware_set", label: "餐具套装", catalogItemIds: ["kitchen_cutlery", "kitchen_bowl_mug"] },
  { id: "thermos", label: "保温杯" },
  { id: "knife", label: "小刀", transport: "仅托运", remark: "不能随身携带" },
  { id: "repair_tools", label: "多功能五金维修工具", transport: "仅托运", remark: "螺丝刀等不能随身携带" },
  { id: "tea", label: "茶叶" },
  { id: "hand_warmer", label: "暖宝宝" },
  { id: "pot", label: "锅", remark: "先确认炉灶兼容性，不自动排除英国锅具" },
  { id: "bowls", label: "碗" },
  { id: "spoons", label: "勺子" },
  { id: "chopsticks", label: "筷子" },
  { id: "wash_basin", label: "脸盆" },
  { id: "hangers", label: "衣架", catalogItemIds: ["living_hangers"] },
  { id: "hair_filter", label: "毛发过滤网" },
  { id: "bin_bags", label: "垃圾袋", catalogItemIds: ["clean_bin_bags"] }
].map((item) => ({ transport: "托运 / 海运", ...item }));

export function shoppingLinksFor({ category, query } = {}) {
  const text = String(query || "").trim();
  if (!text) return [];
  const encoded = encodeURIComponent(text);
  const argosSlug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const providers = {
    google: { label: "Google Shopping", url: `https://www.google.co.uk/search?tbm=shop&hl=en&gl=uk&q=${encoded}` },
    argos: { label: "Argos", url: `https://www.argos.co.uk/search/${encodeURIComponent(argosSlug)}/` },
    dunelm: { label: "Dunelm", url: `https://www.dunelm.com/search?q=${encoded}` },
    ikea: { label: "IKEA UK", url: `https://www.ikea.com/gb/en/search/?q=${encoded}` },
    amazon: { label: "Amazon UK", url: `https://www.amazon.co.uk/s?k=${encoded}` }
  };
  const byCategory = {
    "床品": [providers.google, providers.dunelm, providers.argos],
    "电器": [providers.google, providers.argos, providers.amazon],
    "厨房": [providers.google, providers.argos, providers.ikea],
    "清洁": [providers.google, providers.argos, providers.amazon],
    "卫浴": [providers.google, providers.dunelm, providers.amazon],
    "生活": [providers.google, providers.argos, providers.dunelm]
  };
  return byCategory[category] || [providers.google, providers.argos, providers.amazon];
}
