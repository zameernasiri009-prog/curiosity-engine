export class AnalyticsManager {
  constructor(backendStore) {
    this.backend = backendStore;
    this.modalEl = document.getElementById("overlay-analytics");
    this.metricsEl = document.getElementById("analytics-metrics");
    this.leaderboardEl = document.getElementById("analytics-leaderboard");
    this.logEl = document.getElementById("analytics-event-log");
    this.serverInputEl = document.getElementById("input-backend-url");
    this.syncStateEl = document.getElementById("analytics-sync-detail");
    this.bindUI();
  }

  bindUI() {
    const openBtn = document.getElementById("btn-open-analytics");
    const closeBtn = document.getElementById("btn-close-analytics");
    const clearBtn = document.getElementById("btn-clear-events");
    const syncNowBtn = document.getElementById("btn-sync-now");
    const saveUrlBtn = document.getElementById("btn-save-backend-url");

    if (openBtn) {
      openBtn.addEventListener("click", () => this.open());
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.backend.events = [];
        try {
          localStorage.removeItem("curiosity_engine_events_v1");
        } catch (_err) {
          // Ignore restricted storage
        }
        this.render();
      });
    }
    if (syncNowBtn) {
      syncNowBtn.addEventListener("click", async () => {
        await this.backend.checkHealthAndFlush();
        await this.backend.fetchLeaderboard(10);
        this.render();
      });
    }
    if (saveUrlBtn && this.serverInputEl) {
      this.serverInputEl.value = this.backend.baseUrl || "";
      saveUrlBtn.addEventListener("click", async () => {
        const raw = (this.serverInputEl.value || "").trim();
        if (!raw) return;
        this.backend.baseUrl = raw.replace(/\/+$/, "");
        await this.backend.checkHealthAndFlush();
        await this.backend.fetchLeaderboard(10);
        this.render();
      });
    }
  }

  open() {
    if (this.serverInputEl) {
      this.serverInputEl.value = this.backend.baseUrl || "";
    }
    this.render();
    if (this.modalEl) {
      this.modalEl.classList.add("active");
    }
    this.backend.fetchLeaderboard(10).then(() => {
      if (this.modalEl && this.modalEl.classList.contains("active")) {
        this.renderLeaderboardOnly();
        this.renderSyncDetail();
      }
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove("active");
    }
  }

  computeSummary() {
    const profile = this.backend.profile || {};
    const events = Array.isArray(this.backend.events) ? this.backend.events : [];
    const completedRuns = events.filter((e) => e.event === "run_completed");
    const victories = completedRuns.filter((e) => e.payload && e.payload.victory).length;

    let avgPeakCuriosity = 0;
    if (completedRuns.length > 0) {
      const sumCur = completedRuns.reduce(
        (acc, item) => acc + (Number(item.payload?.peakCuriosity) || 0),
        0
      );
      avgPeakCuriosity = Math.round(sumCur / completedRuns.length);
    }

    return {
      bestScore: Number(profile.bestScore) || 0,
      totalRuns: Number(profile.totalRuns) || 0,
      victories,
      totalProbesFired: Number(profile.totalProbesFired) || 0,
      avgPeakCuriosity,
      eventCount: events.length
    };
  }

  renderSyncDetail() {
    if (!this.syncStateEl) return;
    const queuedCount = Array.isArray(this.backend.syncQueue) ? this.backend.syncQueue.length : 0;
    const onlineText = this.backend.serverOnline ? "SERVER ONLINE" : "OFFLINE / LOCAL";
    this.syncStateEl.textContent = `Status: ${this.backend.syncStatus} (${onlineText}) • Queued: ${queuedCount} • Target: ${this.backend.baseUrl}`;
  }

  renderLeaderboardOnly() {
    if (!this.leaderboardEl) return;
    const rows = Array.isArray(this.backend.cachedLeaderboard) ? this.backend.cachedLeaderboard : [];
    this.leaderboardEl.innerHTML = "";

    if (rows.length === 0) {
      const localBest = Number(this.backend.profile?.bestScore) || 0;
      const emptyRow = document.createElement("div");
      emptyRow.className = "leaderboard-row";
      emptyRow.textContent =
        localBest > 0
          ? `Local Best: ${localBest.toLocaleString()} pts — Start server (npm start) and click Sync Now for global board.`
          : "No server runs recorded yet. Complete a run or start server/index.js to record scores.";
      this.leaderboardEl.appendChild(emptyRow);
      return;
    }

    rows.slice(0, 8).forEach((entry, idx) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";
      const tag = entry.playerTag || entry.clientId || "Observer";
      const scoreNum = Number(entry.score) || 0;
      const curNum = Number(entry.peakCuriosity) || 0;
      const modeName = String(entry.mode || "standard").toUpperCase();
      const badge = entry.victory ? "WIN" : "RUN";
      row.textContent = `#${idx + 1} ${tag} — ${scoreNum.toLocaleString()} pts | Cur: ${curNum}% | ${modeName} [${badge}]`;
      this.leaderboardEl.appendChild(row);
    });
  }

  render() {
    if (!this.metricsEl || !this.logEl) return;
    const summary = this.computeSummary();

    const cards = [
      { label: "Best Score", val: summary.bestScore.toLocaleString() },
      { label: "Total Runs", val: String(summary.totalRuns) },
      { label: "Victories", val: String(summary.victories) },
      { label: "Probes Fired", val: String(summary.totalProbesFired) },
      { label: "Avg Peak Curiosity", val: `${summary.avgPeakCuriosity}%` },
      { label: "Logged Events", val: String(summary.eventCount) }
    ];

    this.metricsEl.innerHTML = "";
    for (const c of cards) {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      tile.innerHTML = `<div class="k">${c.label}</div><div class="v">${c.val}</div>`;
      this.metricsEl.appendChild(tile);
    }

    this.renderSyncDetail();
    this.renderLeaderboardOnly();

    const recent = [...(this.backend.events || [])].reverse().slice(0, 35);
    this.logEl.innerHTML = "";

    if (recent.length === 0) {
      const empty = document.createElement("div");
      empty.className = "event-row";
      empty.textContent = "No telemetry events recorded yet. Start a run or probe an anomaly.";
      this.logEl.appendChild(empty);
      return;
    }

    for (const ev of recent) {
      const row = document.createElement("div");
      row.className = "event-row";
      const timeShort = String(ev.ts || "").slice(11, 19) || "--:--:--";
      const payloadStr = JSON.stringify(ev.payload || {});
      row.textContent = `[${timeShort}] ${ev.event} -> ${payloadStr}`;
      this.logEl.appendChild(row);
    }
  }
}
