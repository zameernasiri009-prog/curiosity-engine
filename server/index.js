import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "store.json");

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_BYTES = 1024 * 256;
const MAX_STORED_EVENTS = 1000;
const MAX_STORED_RUNS = 250;

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
});

function createDefaultStore() {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runs: [],
    events: [],
    codexUnlocks: {}
  };
}

function ensureStoreLoaded() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      const initial = createDefaultStore();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      codexUnlocks:
        parsed.codexUnlocks && typeof parsed.codexUnlocks === "object" ? parsed.codexUnlocks : {}
    };
  } catch (_err) {
    return createDefaultStore();
  }
}

let store = ensureStoreLoaded();

function persistStore() {
  store.updatedAt = new Date().toISOString();
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error("[CuriosityEngine API] Failed to persist store:", err.message);
    return false;
  }
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Client-Id");
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_err) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", (err) => reject(err));
  });
}

function clampNumber(val, min, max, fallback = 0) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeString(val, maxLen = 64, fallback = "unknown") {
  if (typeof val !== "string") return fallback;
  const cleaned = val.trim().slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeRunRecord(raw = {}, clientId = "anonymous") {
  const score = Math.round(clampNumber(raw.score, 0, 10000000, 0));
  const peakCuriosity = Math.round(clampNumber(raw.peakCuriosity, 0, 100, 0));
  const probesFired = Math.round(clampNumber(raw.probesFired, 0, 100000, 0));
  const mode = ["calm", "standard", "volatile"].includes(raw.mode) ? raw.mode : "standard";
  const victory = Boolean(raw.victory);
  const playerTag = sanitizeString(raw.playerTag || clientId, 28, "Observer");

  return {
    id: typeof raw.id === "string" && raw.id.length <= 64 ? raw.id : `run-${crypto.randomUUID()}`,
    clientId: sanitizeString(clientId, 48, "anonymous"),
    playerTag,
    score,
    peakCuriosity,
    probesFired,
    victory,
    mode,
    submittedAt: new Date().toISOString()
  };
}

function normalizeEventRecord(raw = {}, clientId = "anonymous") {
  const eventName = sanitizeString(raw.event || raw.eventName, 48, "telemetry_ping");
  const safePayload =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? raw.payload
      : {};

  return {
    id: typeof raw.id === "string" && raw.id.length <= 64 ? raw.id : `ev-${crypto.randomUUID()}`,
    clientId: sanitizeString(clientId, 48, "anonymous"),
    event: eventName,
    payload: safePayload,
    ts: typeof raw.ts === "string" && raw.ts.length <= 40 ? raw.ts : new Date().toISOString()
  };
}

function getSortedLeaderboard(limit = 15) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 15));
  return [...store.runs]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.peakCuriosity !== a.peakCuriosity) return b.peakCuriosity - a.peakCuriosity;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    })
    .slice(0, safeLimit);
}

function tryServeStaticFile(reqPath, res) {
  const cleanPath = reqPath === "/" ? "/index.html" : reqPath;
  const normalized = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(ROOT_DIR, normalized);

  if (!fullPath.startsWith(ROOT_DIR)) {
    return false;
  }

  try {
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      return false;
    }
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const data = fs.readFileSync(fullPath);
    setCorsHeaders(res);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length
    });
    res.end(data);
    return true;
  } catch (_err) {
    return false;
  }
}

async function handleApiRequest(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;
  const method = req.method || "GET";
  const clientId = sanitizeString(req.headers["x-client-id"] || "browser-client", 48, "browser-client");

  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "curiosity-engine-backend",
      version: "1.0.0",
      uptimeSec: Math.round(process.uptime()),
      totalRuns: store.runs.length,
      totalEvents: store.events.length,
      updatedAt: store.updatedAt
    });
  }

  if (method === "GET" && pathname === "/api/leaderboard") {
    const limit = clampNumber(parsedUrl.searchParams.get("limit"), 1, 50, 15);
    const mode = parsedUrl.searchParams.get("mode");
    let entries = getSortedLeaderboard(50);
    if (mode && ["calm", "standard", "volatile"].includes(mode)) {
      entries = entries.filter((item) => item.mode === mode);
    }
    return sendJson(res, 200, {
      ok: true,
      leaderboard: entries.slice(0, limit)
    });
  }

  if (method === "GET" && pathname === "/api/runs") {
    const limit = clampNumber(parsedUrl.searchParams.get("limit"), 1, 100, 30);
    return sendJson(res, 200, {
      ok: true,
      runs: store.runs.slice(-limit).reverse()
    });
  }

  if (method === "POST" && pathname === "/api/runs") {
    const body = await readJsonBody(req);
    const record = normalizeRunRecord(body, clientId);
    const existingIdx = store.runs.findIndex((r) => r.id === record.id);
    if (existingIdx >= 0) {
      store.runs[existingIdx] = record;
    } else {
      store.runs.push(record);
    }
    if (store.runs.length > MAX_STORED_RUNS) {
      store.runs.splice(0, store.runs.length - MAX_STORED_RUNS);
    }
    const saved = persistStore();
    return sendJson(res, 201, {
      ok: true,
      persisted: saved,
      run: record,
      topRank: getSortedLeaderboard(50).findIndex((item) => item.id === record.id) + 1
    });
  }

  if (method === "DELETE" && pathname === "/api/runs") {
    store.runs = [];
    const saved = persistStore();
    return sendJson(res, 200, {
      ok: true,
      persisted: saved,
      clearedRuns: true
    });
  }

  if (method === "GET" && pathname === "/api/events") {
    const limit = clampNumber(parsedUrl.searchParams.get("limit"), 1, 250, 60);
    return sendJson(res, 200, {
      ok: true,
      events: store.events.slice(-limit).reverse()
    });
  }

  if (method === "POST" && pathname === "/api/events") {
    const body = await readJsonBody(req);
    const incomingBatch = Array.isArray(body.events) ? body.events : [body];
    const accepted = [];

    for (const rawEv of incomingBatch.slice(0, 50)) {
      const ev = normalizeEventRecord(rawEv, clientId);
      if (!store.events.some((existing) => existing.id === ev.id)) {
        store.events.push(ev);
        accepted.push(ev);
      }
    }

    if (store.events.length > MAX_STORED_EVENTS) {
      store.events.splice(0, store.events.length - MAX_STORED_EVENTS);
    }
    const saved = persistStore();
    return sendJson(res, 201, {
      ok: true,
      persisted: saved,
      acceptedCount: accepted.length
    });
  }

  if (method === "DELETE" && pathname === "/api/events") {
    store.events = [];
    const saved = persistStore();
    return sendJson(res, 200, {
      ok: true,
      persisted: saved,
      cleared: true
    });
  }

  if (method === "POST" && pathname === "/api/codex/unlock") {
    const body = await readJsonBody(req);
    const code = sanitizeString(body.code, 32, "");
    if (!code) {
      return sendJson(res, 400, { ok: false, error: "Missing codex code" });
    }
    if (!Array.isArray(store.codexUnlocks[clientId])) {
      store.codexUnlocks[clientId] = [];
    }
    if (!store.codexUnlocks[clientId].includes(code)) {
      store.codexUnlocks[clientId].push(code);
      persistStore();
    }
    return sendJson(res, 200, {
      ok: true,
      clientId,
      discoveredCodes: store.codexUnlocks[clientId]
    });
  }

  return sendJson(res, 404, { ok: false, error: "Endpoint not found" });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (parsedUrl.pathname.startsWith("/api/")) {
      await handleApiRequest(req, res, parsedUrl);
      return;
    }

    if (req.method === "GET" && tryServeStaticFile(parsedUrl.pathname, res)) {
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    const message = err && err.message ? err.message : "Internal server error";
    const status = message === "Invalid JSON payload" || message === "Payload too large" ? 400 : 500;
    sendJson(res, status, { ok: false, error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[CuriosityEngine Server] Running at http://localhost:${PORT}`);
  console.log(`[CuriosityEngine Server] Storage file: ${DB_FILE}`);
});

