export const SNAPSHOT_AT = "2026-09-12T12:00:00.000Z";

const SNAPSHOT_PRODUCTS = {
  bedding_duvet: [
    { title: "Small Double Duvet 10.5 Tog", priceGbp: 22, merchant: "Demo UK retailer", specs: { bed_size: "Small Double", tog: "10.5" } }
  ],
  bedding_fitted_sheet: [
    { title: "Small Double Fitted Sheet", priceGbp: 9, merchant: "Demo UK retailer", specs: { bed_size: "Small Double" } }
  ],
  bedding_mattress_protector: [
    { title: "Small Double Mattress Protector", priceGbp: 12, merchant: "Demo UK retailer", specs: { bed_size: "Small Double" } }
  ],
  electric_extension: [
    { title: "4-way UK Extension Lead", priceGbp: 12, merchant: "Demo UK retailer", specs: { plug: "UK Type G" } }
  ],
  electric_adapter: [
    { title: "UK Type G Travel Adaptor", priceGbp: 8, merchant: "Demo UK retailer", specs: { plug: "UK Type G" } }
  ],
  kitchen_frying_pan: [
    { title: "Induction Compatible Frying Pan", priceGbp: 15, merchant: "Demo UK retailer", specs: { hob: "Induction compatible" } }
  ],
  kitchen_saucepan: [
    { title: "Induction Compatible Saucepan", priceGbp: 14, merchant: "Demo UK retailer", specs: { hob: "Induction compatible" } }
  ],
  kitchen_kettle: [
    { title: "1.7L Electric Kettle - UK Plug", priceGbp: 16, merchant: "Demo UK retailer", specs: { plug: "UK Type G" } }
  ],
  living_drying_rack: [
    { title: "Folding Indoor Airer", priceGbp: 18, merchant: "Demo UK retailer", specs: {} }
  ],
  living_desk_lamp: [
    { title: "Compact Desk Lamp - UK Plug", priceGbp: 14, merchant: "Demo UK retailer", specs: { plug: "UK Type G" } }
  ]
};

export function snapshotFor(item) {
  const records = SNAPSHOT_PRODUCTS[item.itemId] || [];
  return {
    itemId: item.itemId,
    query: item.ukProductName,
    factStatus: records.length ? "demo-snapshot" : "unavailable",
    fetchedAt: SNAPSHOT_AT,
    candidates: records.map((record, index) => ({
      provider: "demo-snapshot",
      externalId: `snapshot-${item.itemId}-${index + 1}`,
      query: item.ukProductName,
      title: item.itemId.startsWith("bedding_") ? item.ukProductName : record.title,
      priceGbp: record.priceGbp,
      merchant: record.merchant,
      url: null,
      imageUrl: null,
      rating: null,
      reviewCount: null,
      deliveryText: null,
      specs: record.specs,
      fetchedAt: SNAPSHOT_AT,
      missingFields: ["url", "image_url", "rating", "review_count", "delivery_text"],
      factStatus: "demo-snapshot"
    }))
  };
}
