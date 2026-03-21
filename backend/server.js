const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT    = process.env.PORT || 3001;
const API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL   = "mistralai/mistral-small-4-119b-2603";

// Frontend HTML path — works both locally and on Railway
const FRONTEND_HTML = path.join(__dirname, "..", "frontend", "index.html");

// Load .env manually — no dotenv needed in Node 18+
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach(line => {
      const [k, ...v] = line.split("=");
      if (k && v.length) process.env[k.trim()] = v.join("=").trim();
    });
}

const SYSTEM = `You are a 3D mechanical geometry engine. Your only job is to output valid JSON describing a compound 3D part made of primitive shapes. You MUST follow these rules without exception:

RULES:
1. Output ONLY a single raw JSON object. No markdown. No explanation. No text before or after the JSON.
2. Use 4 to 8 primitive shapes per part for good visual detail.
3. Every shape must have a position, rotation, color, metalness, and roughness.
4. Positions must be in the range -2.5 to 2.5 on all axes.
5. Use only these metal color palette values:
   - steel gray   "#8a9aaa"   (main body, shafts, plates)
   - dark steel   "#3a4a5a"   (recesses, holes, dark areas)
   - brushed alum "#b0c0d0"   (smooth surfaces, covers)
   - orange       "#f97316"   (accents, moving parts)
   - black metal  "#1a1a2a"   (seals, gaps)
6. metalness: 0.7-0.9 for metal, 0.0-0.1 for rubber. roughness: 0.1-0.3 for polished, 0.4-0.7 for machined.
7. Use the right shape: cylinders for shafts/bores/pins, boxes for plates/flanges, torus for rings/seals, cones for chamfers, spheres for ball ends.

SHAPE PARAMS:
- box:      { "w": width, "h": height, "d": depth }
- cylinder: { "r": radius, "h": height, "radSeg": 32 }
- sphere:   { "r": radius }
- torus:    { "r": majorRadius, "tube": tubeRadius }
- cone:     { "r": baseRadius, "h": height }

OUTPUT STRUCTURE — output EXACTLY this, filled in:
{
  "type": "compound",
  "name": "<short part name>",
  "description": "<one-line technical description>",
  "dimensions": { "x": <widthMM>, "y": <heightMM>, "z": <depthMM> },
  "parts": [
    {
      "shape": "<box|cylinder|sphere|torus|cone>",
      "params": { <shape params> },
      "position": { "x": <n>, "y": <n>, "z": <n> },
      "rotation": { "x": <n>, "y": <n>, "z": <n> },
      "color": "<#hex>",
      "metalness": <0.0-1.0>,
      "roughness": <0.0-1.0>
    }
  ]
}`;

function apiFetch(body, apiKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function extractJSON(raw) {
  let clean = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!clean) {
    const m = raw.match(/<think>([\s\S]*?)<\/think>/i);
    if (m) { const j = m[1].match(/\{[\s\S]*\}/); if (j) clean = j[0]; }
  }
  if (!clean) {
    const j = raw.match(/\{[\s\S]*\}/);
    if (j) clean = j[0];
  }
  return clean;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // ── Serve frontend ───────────────────────────────────────────────
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    if (fs.existsSync(FRONTEND_HTML)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(FRONTEND_HTML));
    }
    res.writeHead(404);
    return res.end("Frontend not found");
  }

  // ── API ──────────────────────────────────────────────────────────
  if (req.url !== "/api/generate") {
    return send(res, 404, { error: "Not found — use POST /api/generate" });
  }
  if (req.method !== "POST") {
    return send(res, 405, { error: "POST only" });
  }

  let prompt;
  try {
    const bodyRaw = await readBody(req);
    prompt = JSON.parse(bodyRaw).prompt;
  } catch { return send(res, 400, { error: "Invalid JSON body" }); }

  if (!prompt?.trim())          return send(res, 400, { error: "Prompt is required" });
  if (prompt.trim().length < 3)  return send(res, 400, { error: "Prompt too short" });
  if (prompt.trim().length > 500) return send(res, 400, { error: "Prompt too long" });

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return send(res, 500, { error: "NVIDIA_API_KEY not configured" });

  try {
    console.log(`[GEN] "${prompt.trim()}"`);
    const result = await apiFetch({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 2048,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Generate a detailed 3D mechanical part for: ${prompt.trim()}` }
      ]
    }, apiKey);

    if (result.status !== 200) {
      let errMsg = `NVIDIA API error ${result.status}`;
      try { errMsg = JSON.parse(result.body)?.error?.message || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const data = JSON.parse(result.body);
    const raw  = data.choices?.[0]?.message?.content || "";
    console.log("[RAW]", raw.substring(0, 300));

    const clean = extractJSON(raw);
    if (!clean) throw new Error("Empty model response");

    const geometry = JSON.parse(clean);
    if (!Array.isArray(geometry.parts) || geometry.parts.length === 0) {
      throw new SyntaxError("No parts array");
    }

    console.log(`[OK] ${geometry.name} — ${geometry.parts.length} parts`);
    return send(res, 200, geometry);

  } catch (err) {
    if (err instanceof SyntaxError) return send(res, 502, { error: "Model returned invalid JSON — try again." });
    return send(res, 500, { error: err.message || "Generation failed" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nMechaGen  →  http://localhost:${PORT}`);
  console.log(`Model     →  ${MODEL}\n`);
});
