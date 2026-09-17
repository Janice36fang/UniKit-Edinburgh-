import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.mjs";

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("health endpoint exposes demo versus configured service modes", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.rules, "live");
    assert.ok(["configured", "local-demo"].includes(body.contractAnalysis));
  });
});

test("AI settings endpoint exposes sources and models without secrets", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai-settings`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.runtime, "server");
    assert.equal(body.sources.demo.available, true);
    assert.equal(body.sources.codex.available, false);
    assert.ok(Array.isArray(body.sources.gemini.models));
    assert.ok(body.sources.gemini.models.includes("gemini-3.1-flash-lite"));
    assert.ok(Array.isArray(body.sources.openai.models));
    assert.ok(body.sources.openai.models.includes("gpt-5-mini"));
    assert.equal(JSON.stringify(body).includes("OPENAI_API_KEY"), false);
    assert.equal(JSON.stringify(body).includes("GEMINI_API_KEY"), false);
    assert.equal(JSON.stringify(body).includes("sk-"), false);
  });
});

test("demo AI source handles pasted text and rejects file-only analysis honestly", async () => {
  await withServer(async (baseUrl) => {
    const textResponse = await fetch(`${baseUrl}/api/parse-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiSource: "demo", fileName: "sample.txt", mimeType: "text/plain", text: "The room has a single bed and kettle." })
    });
    assert.equal(textResponse.status, 200);
    const textBody = await textResponse.json();
    assert.equal(textBody.source, "local-demo");
    assert.equal(textBody.profile.bedSize.value, "single");

    const fileResponse = await fetch(`${baseUrl}/api/parse-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiSource: "demo", fileName: "sample.pdf", mimeType: "application/pdf", fileData: "data:application/pdf;base64,JVBERi0=" })
    });
    assert.equal(fileResponse.status, 422);
    const fileBody = await fileResponse.json();
    assert.equal(fileBody.error, "DEMO_FILE_UNSUPPORTED");
  });
});

test("demo connection test does not require an API key", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "demo", model: "gpt-5-mini" })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.provider, "演示模式");
  });
});

test("Gemini source reports a missing server key without leaking configuration", async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/ai-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "gemini", model: "gemini-3.1-flash-lite" })
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.error, "AI_NOT_CONFIGURED");
      assert.equal(JSON.stringify(body).includes("AIza"), false);
    });
  } finally {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  }
});

test("contract endpoint extracts pasted contract text without requiring AI credentials", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/parse-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: "sample.txt",
        mimeType: "text/plain",
        text: "Your en-suite room contains a 4ft small double bed and mattress. The shared kitchen includes an induction hob and kettle."
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.profile.bedSize.value, "small-double");
    assert.equal(body.facilities.kettle.value, "yes");
    assert.equal(body.facilities.microwave.value, "unknown");
  });
});

test("recommendations endpoint returns a runnable snapshot fallback", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: { roomType: "ensuite-small-double", bedSize: "small-double", moveIn: "within-7", budget: 180, cooking: "sometimes", location: "china", preparedFittedSheet: "no", preparedFlatSheet: "no", preparedPillow: "no", preparedPillowcase: "no", preparedDomestic: [], luggagePreset: "2x23", checkedBagCount: 2, checkedBagKg: 23, carryOnCount: 1, luggageSpace: "medium", guestCount: "none", carriedText: "转换插头" },
        facilities: { mattress: "yes", pillow: "no", desk_lamp: "unknown", microwave: "yes", kettle: "yes", stovetop: "induction", dishwasher: "unknown", kitchen_storage: "limited", bathroom: "private", bathroom_bin: "no", bathroom_storage: "no", laundry: "yes", vacuum: "unknown", drying: "no" },
        parsedCarried: { items: [{ itemId: "electric_adapter", matchedText: "转换插头", confidence: 1 }], ambiguous: [], unmatched: [], source: "local-rules" }
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.productDataMode, "demo-snapshot");
    assert.ok(body.spendGbp <= 180);
    assert.ok(body.items.length >= 15);
  });
});
