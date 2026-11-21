
export class AnalyticsManager {
  constructor(backendStore) {
    this.backend = backendStore;
    this.modalEl = document.getElementById("overlay-analytics");
    this.metricsEl = document.getElementById("analytics-metrics");
    this.logEl = document.getElementById("analytics-event-log");
    this.bindUI();
  }

  bindUI() {
    const openBtn = document.getElementById("btn-open-analytics");
    const closeBtn = document.getElementById("btn-close-analytics");
    const clearBtn = document.getElementById("btn-clear-events");

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
  }

  open() {
    this.render();
    if (this.modalEl) {
      this.modalEl.classList.add("active");
    }
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
      const sumCur = completedRuns.reduce((acc, item) => acc + (Number(item.payload?.peakCuriosity) || 0), 0);
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
