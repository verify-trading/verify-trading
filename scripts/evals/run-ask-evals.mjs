import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";

const baseUrl = process.env.ASK_EVAL_BASE_URL ?? "http://localhost:3000";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const casesPath = path.join(repoRoot, "tests", "evals", "ask-evals.json");

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const value of buffer) {
    crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function createPngDataUrl({ width, height, drawPixel }) {
  const rowLength = width * 3 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    raw[rowOffset] = 0;

    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + 1 + x * 3;
      const [r, g, b] = drawPixel(x, y);
      raw[pixelOffset] = r;
      raw[pixelOffset + 1] = g;
      raw[pixelOffset + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk("IHDR", ihdr),
    createChunk("IDAT", zlib.deflateSync(raw)),
    createChunk("IEND"),
  ]);

  return `data:image/png;base64,${png.toString("base64")}`;
}

function buildSyntheticChartImage() {
  const width = 900;
  const height = 520;
  const navy = [10, 13, 46];
  const panel = [20, 25, 76];
  const blue = [76, 110, 245];
  const coral = [242, 109, 109];
  const green = [34, 197, 94];
  const grid = [49, 59, 110];
  const linePoints = [
    [90, 380],
    [140, 340],
    [190, 320],
    [240, 350],
    [290, 300],
    [340, 270],
    [390, 250],
    [440, 260],
    [490, 220],
    [540, 210],
    [590, 235],
    [640, 190],
    [690, 160],
    [740, 145],
    [790, 130],
  ];

  function isNearLine(x, y, yTarget, thickness = 2) {
    return Math.abs(y - yTarget) <= thickness && x >= 80 && x <= 820;
  }

  function isNearPolyline(x, y) {
    for (let index = 0; index < linePoints.length - 1; index += 1) {
      const [x1, y1] = linePoints[index];
      const [x2, y2] = linePoints[index + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSquared = dx * dx + dy * dy;
      const t = Math.max(
        0,
        Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared),
      );
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const distance = Math.hypot(x - px, y - py);
      if (distance <= 4) {
        return true;
      }
    }

    return false;
  }

  return createPngDataUrl({
    width,
    height,
    drawPixel(x, y) {
      let color = navy;

      if (x >= 40 && x <= 860 && y >= 40 && y <= 480) {
        color = panel;
      }

      if (
        (y >= 100 && y <= 450 && y % 70 <= 1 && x >= 70 && x <= 830) ||
        (x >= 100 && x <= 730 && x % 90 <= 1 && y >= 80 && y <= 450)
      ) {
        color = grid;
      }

      if (isNearLine(x, y, 170)) {
        color = coral;
      } else if (isNearLine(x, y, 335)) {
        color = blue;
      } else if (isNearPolyline(x, y)) {
        color = green;
      }

      return color;
    },
  });
}

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function parseSseCard(body) {
  const lines = body.split("\n").filter((line) => line.startsWith("data: "));
  let jsonText = "";
  let session = null;

  for (const line of lines) {
    const raw = line.slice(6);
    if (raw === "[DONE]") {
      continue;
    }

    try {
      const event = JSON.parse(raw);
      if (event.type === "text-delta") {
        jsonText += event.delta;
      }
      if (event.type === "data-session") {
        session = event.data;
      }
    } catch {
      // ignore stream parts that are not JSON payloads
    }
  }

  const firstBrace = jsonText.indexOf("{");
  const lastBrace = jsonText.lastIndexOf("}");
  const parsed =
    firstBrace !== -1 && lastBrace > firstBrace
      ? JSON.parse(jsonText.slice(firstBrace, lastBrace + 1))
      : null;

  return {
    card: parsed,
    session,
  };
}

function evaluateCase(testCase, card) {
  const issues = [];

  if (!card) {
    issues.push("No parseable card JSON returned.");
    return issues;
  }

  if (card.type !== testCase.expectedType) {
    issues.push(`Expected type ${testCase.expectedType}, got ${card.type}.`);
  }

  if (card.type === "insight" && typeof card.headline === "string" && wordCount(card.headline) > 4) {
    issues.push(`Insight headline exceeds 4 words: "${card.headline}".`);
  }

  if (testCase.id === "projection-explicit" && typeof card.verdict === "string" && !card.verdict.startsWith("Using ")) {
    issues.push("Explicit projection assumptions were not described as user-supplied.");
  }

  if (testCase.id === "projection-default" && typeof card.verdict === "string" && !card.verdict.startsWith("Base case uses")) {
    issues.push("Default projection assumptions were not described as base case.");
  }

  if (testCase.id === "growth-plan-balance") {
    if (card.type !== "plan") {
      issues.push(`Growth plan expected type plan, got ${card.type}.`);
    }
    if (card.type === "plan" && card.currencySymbol !== "$") {
      issues.push(`Growth plan expected $ currency, got ${card.currencySymbol}.`);
    }
  }

  if (testCase.id === "calc-follow-up-risk" && card.type === "calc" && card.risk_pct !== "2%") {
    issues.push(`Follow-up risk did not reuse prior session correctly. Got risk_pct=${card.risk_pct}.`);
  }

  if (testCase.id === "mixed-priority-followup-size" && card.type === "calc" && card.risk_pct !== "0.8%") {
    issues.push(`Mixed-thread risk context was not reused correctly. Got risk_pct=${card.risk_pct}.`);
  }

  if (
    (testCase.id === "setup-thread-absurd" || testCase.id === "desk-thread-absurd") &&
    card.type === "insight" &&
    card.headline !== "Outside Scope"
  ) {
    issues.push(`Absurd out-of-scope turn should return Outside Scope, got headline "${card.headline}".`);
  }

  if (testCase.id === "broker-pepperstone" && card.type === "broker" && card.fca !== "Yes") {
    issues.push(`Pepperstone broker check expected FCA Yes, got ${card.fca}.`);
  }

  if (testCase.id === "guru-switzyman" && card.type === "guru" && card.status !== "AVOID") {
    issues.push(`SwitzyMan expected AVOID, got ${card.status}.`);
  }

  return issues;
}

async function main() {
  const testCases = JSON.parse(await fs.readFile(casesPath, "utf8"));
  const sessionIds = new Map();
  const syntheticChart = buildSyntheticChartImage();
  const results = [];

  for (const testCase of testCases) {
    const sessionId =
      testCase.sessionGroup
        ? (sessionIds.get(testCase.sessionGroup) ?? crypto.randomUUID())
        : crypto.randomUUID();

    if (testCase.sessionGroup && !sessionIds.has(testCase.sessionGroup)) {
      sessionIds.set(testCase.sessionGroup, sessionId);
    }

    const image =
      testCase.image === "synthetic-chart"
        ? syntheticChart
        : null;

    const response = await fetch(`${baseUrl}/api/ask`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: testCase.message,
        sessionId,
        image,
      }),
    });

    const body = await response.text();
    const { card, session } = parseSseCard(body);
    const issues = evaluateCase(testCase, card);

    results.push({
      id: testCase.id,
      status: response.status,
      type: card?.type ?? null,
      ok: response.ok && issues.length === 0,
      issues,
      card,
      sessionId: session?.sessionId ?? sessionId,
    });
  }

  const passes = results.filter((result) => result.ok).length;

  console.log(`\\nAsk evals: ${passes}/${results.length} passed\\n`);

  for (const result of results) {
    const marker = result.ok ? "PASS" : "FAIL";
    console.log(`${marker} ${result.id} -> ${result.type ?? "no-card"} (${result.status})`);
    if (result.issues.length > 0) {
      for (const issue of result.issues) {
        console.log(`  - ${issue}`);
      }
    }
  }

  if (passes !== results.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
