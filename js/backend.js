import { CONFIG } from "./config.js";

function fetchWithTimeout(url, options = {}, timeoutMs = CONFIG.BACKEND.REQUEST_TIMEOUT_MS) {
  if (typeof fetch !== "function") {
    return Promise.reject(new Error("fetch unavailable"));
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  return fetch(url, {
    ...options,
    signal: controller ? controller.signal : undefined
  }).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export class LocalBackendStore {
  constructor() {
    this.baseUrl = this.resolveBaseUrl();
    this.clientId = this.resolveClientId();
    this.syncStatus = "LOCAL-OK";
    this.serverOnline = false;
    this.profile = this.loadProfile();
    this.events = this.loadEvents();
    this.syncQueue = this.loadQueue();
    this.cachedLeaderboard = [];
    this.onStatusChange = null;

    this.checkHealthAndFlush();
    setInterval(() => {
      this.checkHealthAndFlush();
    }, CONFIG.BACKEND.HEALTH_CHECK_MS);
  }

  resolveBaseUrl() {
    if (window.location && /^https?:$/i.test(window.location.protocol)) {
      if (window.location.port === "8787") {
        return window.location.origin;
      }
    }
    return CONFIG.BACKEND.DEFAULT_BASE_URL;
  }

  resolveClientId() {
    try {
      let existing = localStorage.getItem(CONFIG.STORAGE_KEY_CLIENT_ID);
      if (!existing) {
        existing = `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(CONFIG.STORAGE_KEY_CLIENT_ID, existing);
      }
      return existing;
    } catch (_err) {
      return "obs-ephemeral";
    }
  }

  setSyncStatus(nextStatus) {
    this.syncStatus = nextStatus;
    if (typeof this.onStatusChange === "function") {
      this.onStatusChange(nextStatus);
    }
  }

  loadProfile() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY_STATE);
      if (!raw) {
        return {
          bestScore: 0,
          totalRuns: 0,
          totalProbesFired: 0,
          discoveredCodes: [],
          preferredMode: "standard"
        };
      }
      const parsed = JSON.parse(raw);
      return {
        bestScore: Number(parsed.bestScore) || 0,
        totalRuns: Number(parsed.totalRuns) || 0,
        totalProbesFired: Number(parsed.totalProbesFired) || 0,
        discoveredCodes: Array.isArray(parsed.discoveredCodes) ? parsed.discoveredCodes : [],
        preferredMode: CONFIG.MODES[parsed.preferredMode] ? parsed.preferredMode : "standard"
      };
    } catch (_err) {
      this.setSyncStatus("MEM-FALLBACK");
      return {
        bestScore: 0,
        totalRuns: 0,
        totalProbesFired: 0,
        discoveredCodes: [],
        preferredMode: "standard"
      };
    }
  }

  saveProfile() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_STATE, JSON.stringify(this.profile));
      if (!this.serverOnline && this.syncStatus !== "MEM-FALLBACK") {
        this.setSyncStatus("LOCAL-OK");
      }
    } catch (_err) {
      this.setSyncStatus("MEM-FALLBACK");
    }
  }

  loadEvents() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY_EVENTS);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_err) {
      return [];
    }
  }

  loadQueue() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY_QUEUE);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_err) {
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_QUEUE, JSON.stringify(this.syncQueue));
    } catch (_err) {
      // Ignore storage quota errors
    }
  }

  enqueueSyncItem(kind, payload) {
    this.syncQueue.push({
      kind,
      payload,
      queuedAt: new Date().toISOString()
    });
    if (this.syncQueue.length > CONFIG.MAX_SYNC_QUEUE) {
      this.syncQueue.splice(0, this.syncQueue.length - CONFIG.MAX_SYNC_QUEUE);
    }
    this.saveQueue();
    this.flushQueue();
  }

  recordEvent(eventName, payload = {}) {
    const entry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      event: eventName,
      payload
    };
    this.events.push(entry);
    if (this.events.length > CONFIG.MAX_STORED_EVENTS) {
      this.events.splice(0, this.events.length - CONFIG.MAX_STORED_EVENTS);
    }
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_EVENTS, JSON.stringify(this.events));
    } catch (_err) {
      // Ignore storage quota errors in restricted sandboxes
    }
    this.enqueueSyncItem("event", entry);
  }

  recordRunSummary({ score, peakCuriosity, probesFired, victory, mode }) {
    this.profile.totalRuns += 1;
    this.profile.totalProbesFired += probesFired;
    if (score > this.profile.bestScore) {
      this.profile.bestScore = Math.round(score);
    }
    this.profile.preferredMode = mode;
    this.saveProfile();

    const runPayload = {
      id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      score: Math.round(score),
      peakCuriosity: Math.round(peakCuriosity),
      probesFired,
      victory: Boolean(victory),
      mode
    };

    this.recordEvent("run_completed", runPayload);
    this.enqueueSyncItem("run", runPayload);
  }

  unlockCodex(code) {
    if (!code || this.profile.discoveredCodes.includes(code)) return false;
    this.profile.discoveredCodes.push(code);
    this.saveProfile();
    this.recordEvent("codex_unlocked", { code });
    this.enqueueSyncItem("codex", { code });
    return true;
  }

  async checkHealthAndFlush() {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/api/health`, {
        method: "GET",
        headers: { "X-Client-Id": this.clientId }
      });
      if (!res.ok) {
        this.serverOnline = false;
        this.setSyncStatus(this.syncQueue.length > 0 ? "QUEUED" : "LOCAL-OK");
        return false;
      }
      this.serverOnline = true;
      await this.flushQueue();
      return true;
    } catch (_err) {
      this.serverOnline = false;
      this.setSyncStatus(this.syncQueue.length > 0 ? "QUEUED" : "LOCAL-OK");
      return false;
    }
  }

  async flushQueue() {
    if (this.syncQueue.length === 0) {
      this.setSyncStatus(this.serverOnline ? "API-SYNCED" : "LOCAL-OK");
      return;
    }

    const remaining = [];
    let anySent = false;

    for (const item of this.syncQueue) {
      try {
        let endpoint = "/api/events";
        let body = item.payload;

        if (item.kind === "run") {
          endpoint = "/api/runs";
        } else if (item.kind === "codex") {
          endpoint = "/api/codex/unlock";
        }

        const res = await fetchWithTimeout(`${this.baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Client-Id": this.clientId
          },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          this.serverOnline = true;
          anySent = true;
        } else {
          remaining.push(item);
        }
      } catch (_err) {
        this.serverOnline = false;
        remaining.push(item);
      }
    }

    this.syncQueue = remaining;
    this.saveQueue();

    if (this.syncQueue.length === 0 && this.serverOnline) {
      this.setSyncStatus("API-SYNCED");
    } else if (anySent || this.syncQueue.length > 0) {
      this.setSyncStatus("QUEUED");
    } else {
      this.setSyncStatus("LOCAL-OK");
    }
  }

  async fetchLeaderboard(limit = 10) {
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/api/leaderboard?limit=${encodeURIComponent(limit)}`,
        {
          method: "GET",
          headers: { "X-Client-Id": this.clientId }
        }
      );
      if (!res.ok) return this.cachedLeaderboard;
      const data = await res.json();
      if (Array.isArray(data.leaderboard)) {
        this.cachedLeaderboard = data.leaderboard;
        this.serverOnline = true;
        this.setSyncStatus(this.syncQueue.length > 0 ? "QUEUED" : "API-SYNCED");
      }
      return this.cachedLeaderboard;
    } catch (_err) {
      return this.cachedLeaderboard;
    }
  }
}
