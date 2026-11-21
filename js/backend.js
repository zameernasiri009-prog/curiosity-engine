import { CONFIG } from "./config.js";

export class LocalBackendStore {
  constructor() {
    this.remoteEndpoint = null;
    this.syncStatus = "LOCAL-OK";
    this.profile = this.loadProfile();
    this.events = this.loadEvents();
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
      this.syncStatus = "MEM-FALLBACK";
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
      if (this.syncStatus !== "SYNCED-API") {
        this.syncStatus = "LOCAL-OK";
      }
    } catch (_err) {
      this.syncStatus = "MEM-FALLBACK";
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
    this.flushRemoteIfConfigured(entry);
  }

  async flushRemoteIfConfigured(entry) {
    if (!this.remoteEndpoint || typeof fetch !== "function") return;
    try {
      const res = await fetch(this.remoteEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        this.syncStatus = "SYNCED-API";
      }
    } catch (_err) {
      this.syncStatus = "LOCAL-OK";
    }
  }

  recordRunSummary({ score, peakCuriosity, probesFired, victory, mode }) {
    this.profile.totalRuns += 1;
    this.profile.totalProbesFired += probesFired;
    if (score > this.profile.bestScore) {
      this.profile.bestScore = Math.round(score);
    }
    this.profile.preferredMode = mode;
    this.saveProfile();
    this.recordEvent("run_completed", {
      score: Math.round(score),
      peakCuriosity: Math.round(peakCuriosity),
      probesFired,
      victory: Boolean(victory),
      mode
    });
  }

  unlockCodex(code) {
    if (!code || this.profile.discoveredCodes.includes(code)) return false;
    this.profile.discoveredCodes.push(code);
    this.saveProfile();
    this.recordEvent("codex_unlocked", { code });
    return true;
  }
}

