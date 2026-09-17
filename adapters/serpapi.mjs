const DEFAULT_ALLOWLIST = ["Argos", "IKEA", "Dunelm", "John Lewis", "Tesco", "ASDA"];

function parsePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}

function includesMerchant(source, allowlist) {
  const normalized = String(source || "").toLowerCase();
  return allowlist.some((merchant) => normalized.includes(merchant.toLowerCase()));
}

function missingFields(candidate) {
  const fields = {
    title: candidate.title,
    price_gbp: candidate.priceGbp,
    merchant: candidate.merchant,
    url: candidate.url,
    image_url: candidate.imageUrl,
    rating: candidate.rating,
    review_count: candidate.reviewCount,
    delivery_text: candidate.deliveryText
  };
  return Object.entries(fields).filter(([, value]) => value === null || value === undefined || value === "").map(([key]) => key);
}

export function normalizeSerpResults(payload, { query, allowlist = DEFAULT_ALLOWLIST, requiredTerms = [], forbiddenTerms = [] } = {}) {
  const raw = Array.isArray(payload?.shopping_results) ? payload.shopping_results : [];
  const normalized = raw.map((record) => {
    const title = typeof record.title === "string" ? record.title.trim() : null;
    const candidate = {
      provider: "serpapi-google-shopping",
      externalId: record.product_id ? String(record.product_id) : null,
      query,
      title,
      priceGbp: parsePrice(record.extracted_price),
      merchant: record.source || null,
      url: record.product_link || record.link || null,
      imageUrl: record.thumbnail || null,
      rating: Number.isFinite(Number(record.rating)) ? Number(record.rating) : null,
      reviewCount: Number.isFinite(Number(record.reviews)) ? Number(record.reviews) : null,
      deliveryText: record.delivery || null,
      specs: {},
      fetchedAt: new Date().toISOString(),
      factStatus: "live-api"
    };
    candidate.missingFields = missingFields(candidate);
    return candidate;
  });
  const filtered = normalized.filter((candidate) => {
    if (!candidate.title || !candidate.merchant || !includesMerchant(candidate.merchant, allowlist)) return false;
    const haystack = `${candidate.title} ${candidate.deliveryText || ""}`.toLowerCase();
    return requiredTerms.every((term) => haystack.includes(term.toLowerCase())) && forbiddenTerms.every((term) => !haystack.includes(term.toLowerCase()));
  });
  const seen = new Set();
  return filtered.filter((candidate) => {
    const key = candidate.externalId || `${candidate.title.toLowerCase()}|${candidate.merchant.toLowerCase()}|${candidate.priceGbp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

export function merchantAllowlistFromEnv(value) {
  const parsed = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWLIST;
}

export async function searchProducts(item, { apiKey, allowlist = DEFAULT_ALLOWLIST, timeoutMs = 9000 } = {}) {
  if (!apiKey) {
    const error = new Error("SERPAPI_API_KEY is not configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }
  const params = new URLSearchParams({
    engine: "google_shopping",
    q: item.ukProductName,
    location: "Edinburgh, Scotland, United Kingdom",
    gl: "uk",
    hl: "en",
    google_domain: "google.co.uk",
    api_key: apiKey
  });
  const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    const error = new Error(`SerpAPI request failed with ${response.status}`);
    error.code = "UPSTREAM_ERROR";
    throw error;
  }
  const payload = await response.json();
  const queryLower = item.ukProductName.toLowerCase();
  const requiredTerms = [];
  const forbiddenTerms = [];
  if (item.specWarning?.includes("induction compatible")) requiredTerms.push("induction");
  if (queryLower.startsWith("small double ")) requiredTerms.push("small double");
  else if (queryLower.startsWith("single ")) requiredTerms.push("single");
  else if (queryLower.startsWith("double ")) { requiredTerms.push("double"); forbiddenTerms.push("small double"); }
  const candidates = normalizeSerpResults(payload, { query: item.ukProductName, allowlist, requiredTerms, forbiddenTerms });
  return {
    itemId: item.itemId,
    query: item.ukProductName,
    factStatus: candidates.length ? "live-api" : "unavailable",
    fetchedAt: new Date().toISOString(),
    candidates
  };
}
