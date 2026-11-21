import { CONFIG } from "./config.js";
import { SoundEngine } from "./audio.js";
import { LocalBackendStore } from "./backend.js";
import { buildChambers } from "./chambers.js";
import { CodexManager } from "./codex.js";
import { AnalyticsManager } from "./analytics.js";

export class CuriosityEngineGame {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.sound = new SoundEngine();
    this.backend = new LocalBackendStore();
    this.codex = new CodexManager(this.backend);
    this.analytics = new AnalyticsManager(this.backend);

    this.backend.onStatusChange = () => this.updateHud();

    this.ui = {
      chamber: document.getElementById("hud-chamber"),
      integrity: document.getElementById("hud-integrity"),
      integrityBar: document.getElementById("bar-integrity"),
      probe: document.getElementById("hud-probe"),
      probeBar: document.getElementById("bar-probe"),
      curiosity: document.getElementById("hud-curiosity"),
      curiosityBar: document.getElementById("bar-curiosity"),
      score: document.getElementById("hud-score"),
      sync: document.getElementById("hud-sync"),
      overlayTitle: document.getElementById("overlay-title"),
      overlayPause: document.getElementById("overlay-pause"),
      overlayEnd: document.getElementById("overlay-end"),
      overlayCodex: document.getElementById("overlay-codex"),
      overlayAnalytics: document.getElementById("overlay-analytics"),
      endTag: document.getElementById("end-tag"),
      endTitle: document.getElementById("end-title"),
      endSummary: document.getElementById("end-summary"),
      statScore: document.getElementById("stat-score"),
      statCuriosity: document.getElementById("stat-curiosity"),
      statProbes: document.getElementById("stat-probes"),
      statBest: document.getElementById("stat-best"),
      btnFireAction: document.getElementById("btn-fire-action"),
      btnFocusPulse: document.getElementById("btn-focus-pulse"),
      btnAudioToggle: document.getElementById("btn-audio-toggle")
    };

    this.selectedMode = this.backend.profile.preferredMode || "standard";
    this.phase = "title";
    this.chambers = buildChambers();
    this.chamberIndex = 0;
    this.activeMutator = CONFIG.MUTATORS[0];

    this.keys = new Set();
    this.pointer = {
      x: CONFIG.LOGICAL_WIDTH * 0.5,
      y: CONFIG.LOGICAL_HEIGHT * 0.5,
      down: false
    };

    this.player = {
      x: CONFIG.PLAYER.START_X,
      y: CONFIG.PLAYER.START_Y,
      radius: CONFIG.PLAYER.RADIUS,
      speed: CONFIG.PLAYER.SPEED,
      aimAngle: 0,
      integrity: CONFIG.PLAYER.MAX_INTEGRITY,
      maxIntegrity: CONFIG.PLAYER.MAX_INTEGRITY,
      probeCharge: CONFIG.PLAYER.MAX_PROBE_CHARGE,
      maxProbeCharge: CONFIG.PLAYER.MAX_PROBE_CHARGE,
      fireCooldown: 0,
      pulseCooldown: 0,
      invulnTimer: 0
    };

    this.runStats = {
      score: 0,
      curiosity: 0,
      peakCuriosity: 0,
      probesFired: 0,
      elapsedSec: 0,
      bannerTimer: 0,
      bannerText: "",
      pulseWave: null
    };

    this.probes = [];
    this.anomalies = [];
    this.shards = [];
    this.hazards = [];
    this.particles = [];
    this.callouts = [];
    this.exitUnlocked = false;
    this.exitPos = { x: 990, y: 310, radius: 34 };

    this.accumulator = 0;
    this.lastFrameTime = performance.now();

    this.syncModeButtons();
    this.bindEvents();
    this.loadChamber(0, false);
    this.updateHud();
    requestAnimationFrame((now) => this.loop(now));
  }

  getModeConfig() {
    return CONFIG.MODES[this.selectedMode] || CONFIG.MODES.standard;
  }

  pickMutatorForChamber(idx) {
    if (idx === 0) return CONFIG.MUTATORS[0];
    const pool = CONFIG.MUTATORS.slice(1);
    return pool[idx % pool.length] || CONFIG.MUTATORS[0];
  }

  syncModeButtons() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.mode === this.selectedMode);
    });
  }

  hasOpenModal() {
    return Boolean(
      (this.ui.overlayCodex && this.ui.overlayCodex.classList.contains("active")) ||
      (this.ui.overlayAnalytics && this.ui.overlayAnalytics.classList.contains("active"))
    );
  }

  bindEvents() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedMode = btn.dataset.mode;
        this.syncModeButtons();
        this.sound.playTone({ freqStart: 520, freqEnd: 660, duration: 0.08, type: "sine", gainPeak: 0.08 });
      });
    });

    document.getElementById("btn-start-run").addEventListener("click", () => this.startNewRun());
    document.getElementById("btn-play-again").addEventListener("click", () => this.startNewRun());
    document.getElementById("btn-resume-run").addEventListener("click", () => this.resumeGame());
    document.getElementById("btn-restart-chamber").addEventListener("click", () => {
      this.resumeGame();
      this.loadChamber(this.chamberIndex, true);
    });
    document.getElementById("btn-quit-title").addEventListener("click", () => this.returnToTitle());

    this.ui.btnFireAction.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.ui.btnFireAction.classList.add("firing");
      this.triggerFireAction(false);
    });

    window.addEventListener("pointerup", () => {
      this.ui.btnFireAction.classList.remove("firing");
      this.pointer.down = false;
    });

    this.ui.btnFocusPulse.addEventListener("click", () => this.triggerFocusPulse());

    this.ui.btnAudioToggle.addEventListener("click", () => {
      const next = !this.sound.enabled;
      this.sound.setEnabled(next);
      this.ui.btnAudioToggle.textContent = `Audio: ${next ? "ON" : "OFF"}`;
    });

    window.addEventListener("keydown", (e) => {
      const code = e.code;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
        e.preventDefault();
      }
      this.keys.add(code);

      if (code === "Escape") {
        if (this.hasOpenModal()) {
          this.codex.close();
          this.analytics.close();
          return;
        }
      }

      if (code === "KeyP" || code === "Escape") {
        if (this.phase === "playing") this.pauseGame();
        else if (this.phase === "paused") this.resumeGame();
        return;
      }

      if (this.phase === "playing" && !this.hasOpenModal()) {
        if (code === "Space" || code === "KeyF" || code === "Enter") {
          this.triggerFireAction(false);
        } else if (code === "ShiftLeft" || code === "ShiftRight") {
          this.triggerFireAction(true);
        } else if (code === "KeyE") {
          this.triggerFocusPulse();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    this.canvas.addEventListener("pointermove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const sx = (e.clientX - rect.left) / rect.width;
      const sy = (e.clientY - rect.top) / rect.height;
      this.pointer.x = Math.max(0, Math.min(CONFIG.LOGICAL_WIDTH, sx * CONFIG.LOGICAL_WIDTH));
      this.pointer.y = Math.max(0, Math.min(CONFIG.LOGICAL_HEIGHT, sy * CONFIG.LOGICAL_HEIGHT));
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * CONFIG.LOGICAL_WIDTH;
        this.pointer.y = ((e.clientY - rect.top) / rect.height) * CONFIG.LOGICAL_HEIGHT;
      }
      this.pointer.down = true;
      if (this.phase === "playing" && !this.hasOpenModal()) {
        const isOverdrive = e.button === 2 || e.shiftKey;
        this.triggerFireAction(isOverdrive);
      }
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  startNewRun() {
    this.codex.close();
    this.analytics.close();
    this.sound.ensureContext();
    this.chambers = buildChambers();
    this.chamberIndex = 0;
    this.player.integrity = this.player.maxIntegrity;
    this.player.probeCharge = this.player.maxProbeCharge;
    this.player.fireCooldown = 0;
    this.player.pulseCooldown = 0;
    this.player.invulnTimer = 0.6;

    this.runStats = {
      score: 0,
      curiosity: 0,
      peakCuriosity: 0,
      probesFired: 0,
      elapsedSec: 0,
      bannerTimer: 2.2,
      bannerText: "EXPERIMENT STARTED — PROBE EVERY REAL ANOMALY",
      pulseWave: null
    };

    this.setOverlay(null);
    this.phase = "playing";
    this.loadChamber(0, true);
    this.backend.recordEvent("run_started", { mode: this.selectedMode });
    this.sound.playTone({ freqStart: 392, freqEnd: 784, duration: 0.22, type: "triangle", gainPeak: 0.12 });
  }

  pauseGame() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.setOverlay("pause");
  }

  resumeGame() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.setOverlay(null);
    this.lastFrameTime = performance.now();
  }

  returnToTitle() {
    this.codex.close();
    this.analytics.close();
    this.phase = "title";
    this.setOverlay("title");
    this.updateHud();
  }

  setOverlay(name) {
    this.ui.overlayTitle.classList.toggle("active", name === "title");
    this.ui.overlayPause.classList.toggle("active", name === "pause");
    this.ui.overlayEnd.classList.toggle("active", name === "end");
  }

  loadChamber(idx, announce = true) {
    const clamped = Math.max(0, Math.min(this.chambers.length - 1, idx));
    this.chamberIndex = clamped;
    const spec = this.chambers[clamped];
    this.activeMutator = this.pickMutatorForChamber(clamped);

    this.player.x = CONFIG.PLAYER.START_X;
    this.player.y = CONFIG.PLAYER.START_Y;
    this.player.aimAngle = 0;

    this.probes = [];
    this.particles = [];
    this.callouts = [];
    this.exitUnlocked = false;
    this.exitPos = { x: spec.exitPos.x, y: spec.exitPos.y, radius: 34 };

    this.anomalies = spec.anomalies.map((a) => ({
      ...a,
      baseX: a.x,
      baseY: a.y,
      hits: 0,
      resolved: false,
      isDecoy: Boolean(a.isDecoy),
      pulsePhase: Math.random() * Math.PI * 2,
      driftPhase: a.drift ? a.drift.phase || 0 : 0,
      flashTimer: 0
    }));

    this.shards = spec.shards.map((s) => ({
      ...s,
      collected: false,
      bobPhase: Math.random() * Math.PI * 2
    }));

    this.hazards = spec.hazards.map((h) => ({
      ...h,
      x: h.cx + Math.cos(h.angle) * h.orbitRadius,
      y: h.cy + Math.sin(h.angle) * h.orbitRadius
    }));

    if (announce) {
      this.runStats.bannerText = `${spec.code} [${this.activeMutator.name.toUpperCase()}]`;
      this.runStats.bannerTimer = 2.6;
    }
    this.updateHud();
  }

  /**
   * Fires either a standard Curiosity Probe or an Overdrive Probe (power = 2 hits,
   * faster velocity, higher charge cost).
   */
  triggerFireAction(overdrive = false) {
    if (this.phase !== "playing" || this.hasOpenModal()) return;
    if (this.player.fireCooldown > 0) return;

    const useOverdrive = Boolean(overdrive) && this.player.probeCharge >= CONFIG.PLAYER.OVERDRIVE_COST;
    const probeCost = useOverdrive ? CONFIG.PLAYER.OVERDRIVE_COST : CONFIG.PLAYER.PROBE_COST;

    if (this.player.probeCharge < probeCost) {
      this.spawnCallout(this.player.x, this.player.y - 26, "LOW CHARGE", "#f59e0b");
      this.sound.playTone({ freqStart: 180, freqEnd: 130, duration: 0.09, type: "sine", gainPeak: 0.08 });
      return;
    }

    this.player.probeCharge = Math.max(0, this.player.probeCharge - probeCost);
    this.player.fireCooldown = useOverdrive
      ? CONFIG.PLAYER.OVERDRIVE_COOLDOWN
      : CONFIG.PLAYER.FIRE_COOLDOWN;
    this.runStats.probesFired += 1;

    const angle = Math.atan2(this.pointer.y - this.player.y, this.pointer.x - this.player.x);
    this.player.aimAngle = angle;

    const baseSpeed = useOverdrive ? CONFIG.PLAYER.OVERDRIVE_SPEED : CONFIG.PLAYER.PROBE_SPEED;
    const speed = baseSpeed * (this.activeMutator ? this.activeMutator.probeSpeedMult : 1);
    const muzzleDist = this.player.radius + 10;

    this.probes.push({
      x: this.player.x + Math.cos(angle) * muzzleDist,
      y: this.player.y + Math.sin(angle) * muzzleDist,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: useOverdrive ? 10 : 7,
      power: useOverdrive ? 2 : 1,
      overdrive: useOverdrive,
      life: useOverdrive ? CONFIG.PLAYER.OVERDRIVE_LIFE : CONFIG.PLAYER.PROBE_LIFE,
      trail: []
    });

    this.spawnBurst(
      this.player.x + Math.cos(angle) * muzzleDist,
      this.player.y + Math.sin(angle) * muzzleDist,
      useOverdrive ? "#f59e0b" : "#38bdf8",
      useOverdrive ? 12 : 7,
      useOverdrive ? 170 : 120
    );

    if (useOverdrive) {
      this.sound.playTone({ freqStart: 960, freqEnd: 240, duration: 0.19, type: "sawtooth", gainPeak: 0.13 });
      this.spawnCallout(this.player.x, this.player.y - 28, "OVERDRIVE PROBE", "#fbbf24");
    } else {
      this.sound.fireProbe();
    }
    this.updateHud();
  }

  triggerFocusPulse() {
    if (this.phase !== "playing" || this.hasOpenModal()) return;
    if (this.player.pulseCooldown > 0) return;
    if (this.player.probeCharge < CONFIG.PLAYER.PULSE_COST) {
      this.spawnCallout(this.player.x, this.player.y - 26, "NEED 35% CHARGE", "#f59e0b");
      return;
    }

    this.player.probeCharge -= CONFIG.PLAYER.PULSE_COST;
    this.player.pulseCooldown = CONFIG.PLAYER.PULSE_COOLDOWN;
    this.runStats.pulseWave = {
      x: this.player.x,
      y: this.player.y,
      radius: 18,
      maxRadius: CONFIG.PLAYER.PULSE_RADIUS,
      alpha: 0.9
    };

    this.addCuriosity(6);
    this.sound.focusPulse();
    this.spawnCallout(this.player.x, this.player.y - 30, "RESONANCE PULSE", "#a78bfa");

    for (const a of this.anomalies) {
      if (a.resolved) continue;
      const dist = Math.hypot(a.x - this.player.x, a.y - this.player.y);
      if (dist <= CONFIG.PLAYER.PULSE_RADIUS) {
        a.flashTimer = 0.45;
        this.spawnBurst(a.x, a.y, a.isDecoy ? "#fb7185" : "#a78bfa", 8, 110);
      }
    }

    for (const s of this.shards) {
      if (s.collected) continue;
      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1 && dist <= CONFIG.PLAYER.SHARD_ATTRACT_RANGE) {
        s.x += (dx / dist) * 42;
        s.y += (dy / dist) * 42;
      }
    }
  }

  addCuriosity(delta) {
    const mode = this.getModeConfig();
    const mutMult = this.activeMutator ? this.activeMutator.curiosityMult : 1;
    const scaled = delta * mode.curiosityGainScale * mutMult;
    this.runStats.curiosity = Math.max(0, Math.min(100, this.runStats.curiosity + scaled));
    if (this.runStats.curiosity > this.runStats.peakCuriosity) {
      this.runStats.peakCuriosity = this.runStats.curiosity;
    }
  }

  addScore(points) {
    const mult = this.getModeConfig().scoreMultiplier;
    const mutScoreMult = this.activeMutator ? this.activeMutator.scoreMult : 1;
    const curiosityBonus = 1 + (this.runStats.curiosity / 100) * 0.5;
    this.runStats.score += points * mult * mutScoreMult * curiosityBonus;
  }

  spawnBurst(x, y, color, count, speedMax) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * speedMax;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.28 + Math.random() * 0.32,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 2.5
      });
    }
  }

  spawnCallout(x, y, text, color = "#e6edf7") {
    this.callouts.push({
      x,
      y,
      vy: -36,
      text,
      color,
      life: 0.95
    });
  }

  stepSimulation(dt) {
    if (this.phase !== "playing" || this.hasOpenModal()) return;

    const mode = this.getModeConfig();
    const mutator = this.activeMutator || CONFIG.MUTATORS[0];
    this.runStats.elapsedSec += dt;

    if (this.runStats.bannerTimer > 0) {
      this.runStats.bannerTimer = Math.max(0, this.runStats.bannerTimer - dt);
    }

    this.player.fireCooldown = Math.max(0, this.player.fireCooldown - dt);
    this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - dt);
    this.player.invulnTimer = Math.max(0, this.player.invulnTimer - dt);
    this.player.probeCharge = Math.min(
      this.player.maxProbeCharge,
      this.player.probeCharge + mode.probeRegenPerSec * dt
    );

    let moveX = 0;
    let moveY = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) moveX -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) moveX += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) moveY -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      moveX /= len;
      moveY /= len;
      this.player.x += moveX * this.player.speed * dt;
      this.player.y += moveY * this.player.speed * dt;
    }

    const pad = 34;
    this.player.x = Math.max(pad, Math.min(CONFIG.LOGICAL_WIDTH - pad, this.player.x));
    this.player.y = Math.max(pad, Math.min(CONFIG.LOGICAL_HEIGHT - pad, this.player.y));
    this.player.aimAngle = Math.atan2(this.pointer.y - this.player.y, this.pointer.x - this.player.x);

    for (const a of this.anomalies) {
      a.pulsePhase += dt * 3;
      a.flashTimer = Math.max(0, a.flashTimer - dt);
      if (a.drift && !a.resolved) {
        a.driftPhase += a.drift.speed * dt;
        const offset = Math.sin(a.driftPhase) * a.drift.range;
        if (a.drift.axis === "x") {
          a.x = a.baseX + offset;
        } else {
          a.y = a.baseY + offset;
        }
      }
    }

    if (this.runStats.pulseWave) {
      const pw = this.runStats.pulseWave;
      pw.radius += 540 * dt;
      pw.alpha = Math.max(0, 1 - pw.radius / pw.maxRadius);
      if (pw.radius >= pw.maxRadius) {
        this.runStats.pulseWave = null;
      }
    }

    for (let i = this.probes.length - 1; i >= 0; i--) {
      const p = this.probes[i];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      let consumed = false;
      if (
        p.life <= 0 ||
        p.x < 10 ||
        p.x > CONFIG.LOGICAL_WIDTH - 10 ||
        p.y < 10 ||
        p.y > CONFIG.LOGICAL_HEIGHT - 10
      ) {
        consumed = true;
      }

      if (!consumed) {
        for (const a of this.anomalies) {
          if (a.resolved) continue;
          const dist = Math.hypot(p.x - a.x, p.y - a.y);
          if (dist <= a.radius + p.radius) {
            consumed = true;
            a.flashTimer = 0.25;

            if (a.isDecoy) {
              this.addCuriosity(4);
              this.backend.unlockCodex(a.id);
              this.spawnBurst(a.x, a.y, "#fb7185", 10, 120);
              this.spawnCallout(a.x, a.y - a.radius - 8, `${a.label} IS A DECOY`, "#fb7185");
              this.sound.probeHit(false);
              break;
            }

            a.hits += p.power || 1;
            this.addCuriosity(8);
            this.addScore(120 * (p.power || 1));

            if (a.hits >= a.hitsNeeded) {
              a.resolved = true;
              this.addCuriosity(a.curiosityReward);
              this.addScore(350);
              this.backend.unlockCodex(a.id);
              this.spawnBurst(a.x, a.y, "#10b981", 18, 180);
              this.spawnCallout(a.x, a.y - a.radius - 8, `${a.label} UNLOCKED`, "#10b981");
              this.sound.probeHit(true);
            } else {
              this.spawnBurst(p.x, p.y, "#f59e0b", 10, 130);
              this.spawnCallout(a.x, a.y - a.radius - 8, `${a.hits}/${a.hitsNeeded} PROBED`, "#f59e0b");
              this.sound.probeHit(false);
            }
            break;
          }
        }
      }

      if (consumed) {
        this.spawnBurst(p.x, p.y, p.overdrive ? "#fbbf24" : "#38bdf8", 5, 80);
        this.probes.splice(i, 1);
      }
    }

    const realAnomalies = this.anomalies.filter((a) => !a.isDecoy);
    const allResolved = realAnomalies.every((a) => a.resolved);
    if (allResolved && !this.exitUnlocked) {
      this.exitUnlocked = true;
      this.addScore(500);
      this.sound.chamberUnlock();
      this.spawnCallout(this.exitPos.x, this.exitPos.y - 44, "THRESHOLD OPEN", "#10b981");
    }

    for (const s of this.shards) {
      if (s.collected) continue;
      s.bobPhase += dt * 3.4;
      const dist = Math.hypot(this.player.x - s.x, this.player.y - s.y);
      if (dist <= this.player.radius + 14) {
        s.collected = true;
        this.addScore(s.value);
        this.addCuriosity(7);
        this.player.probeCharge = Math.min(this.player.maxProbeCharge, this.player.probeCharge + 20);
        this.spawnBurst(s.x, s.y, "#fbbf24", 12, 140);
        this.spawnCallout(s.x, s.y - 16, `+${s.value}`, "#fbbf24");
        this.sound.collectShard();
      }
    }

    const curiosityHazardSpeedScale = 1 + (this.runStats.curiosity / 100) * 0.35;
    for (const h of this.hazards) {
      h.angle += h.speed * curiosityHazardSpeedScale * mutator.hazardSpeedMult * dt;
      h.x = h.cx + Math.cos(h.angle) * h.orbitRadius;
      h.y = h.cy + Math.sin(h.angle) * h.orbitRadius;

      if (this.player.invulnTimer <= 0) {
        const dist = Math.hypot(this.player.x - h.x, this.player.y - h.y);
        if (dist <= this.player.radius + h.radius) {
          const dmg = Math.round(h.damage * mode.hazardDamageScale);
          this.player.integrity = Math.max(0, this.player.integrity - dmg);
          this.player.invulnTimer = CONFIG.PLAYER.INVULN_DURATION;
          this.spawnBurst(this.player.x, this.player.y, "#f43f5e", 16, 175);
          this.spawnCallout(this.player.x, this.player.y - 26, `-${dmg} INTEGRITY`, "#f43f5e");
          this.sound.damageHit();

          if (this.player.integrity <= 0) {
            this.concludeRun(false);
            return;
          }
        }
      }
    }

    if (this.exitUnlocked) {
      const dExit = Math.hypot(this.player.x - this.exitPos.x, this.player.y - this.exitPos.y);
      if (dExit <= this.player.radius + this.exitPos.radius) {
        if (this.chamberIndex + 1 < this.chambers.length) {
          this.addScore(750);
          this.loadChamber(this.chamberIndex + 1, true);
        } else {
          this.addScore(1500);
          this.concludeRun(true);
          return;
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y += c.vy * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    this.updateHud();
  }

  concludeRun(victory) {
    this.phase = victory ? "victory" : "gameover";
    const finalScore = Math.round(this.runStats.score);
    const peakCur = Math.round(this.runStats.peakCuriosity);

    this.backend.recordRunSummary({
      score: finalScore,
      peakCuriosity: peakCur,
      probesFired: this.runStats.probesFired,
      victory,
      mode: this.selectedMode
    });

    this.ui.endTag.textContent = victory ? "ALL CHAMBERS RESOLVED" : "INTEGRITY DEPLETED";
    this.ui.endTitle.textContent = victory ? "THE ROOM ANSWERS" : "SIGNAL TERMINATED";
    this.ui.endSummary.textContent = victory
      ? "Every real anomaly in the sequence was probed and extracted with your curiosity intact."
      : "Anomalies and volatile echoes overwhelmed your integrity before all thresholds opened.";

    this.ui.statScore.textContent = finalScore.toLocaleString();
    this.ui.statCuriosity.textContent = `${peakCur}%`;
    this.ui.statProbes.textContent = String(this.runStats.probesFired);
    this.ui.statBest.textContent = this.backend.profile.bestScore.toLocaleString();

    this.setOverlay("end");
    this.updateHud();
  }

  updateHud() {
    this.ui.chamber.textContent = `0${this.chamberIndex + 1} / 0${this.chambers.length}`;
    const intPct = Math.round((this.player.integrity / this.player.maxIntegrity) * 100);
    this.ui.integrity.textContent = `${intPct}%`;
    this.ui.integrityBar.style.width = `${intPct}%`;
    this.ui.integrityBar.style.background =
      intPct > 50 ? "var(--accent-emerald)" : intPct > 25 ? "var(--accent-amber)" : "var(--accent-rose)";

    const prbPct = Math.round((this.player.probeCharge / this.player.maxProbeCharge) * 100);
    this.ui.probe.textContent = `${prbPct}%`;
    this.ui.probeBar.style.width = `${prbPct}%`;

    const curPct = Math.round(this.runStats.curiosity);
    this.ui.curiosity.textContent = `${curPct}%`;
    this.ui.curiosityBar.style.width = `${curPct}%`;
    this.ui.curiosityBar.style.background =
      curPct >= 75 ? "var(--accent-amber)" : "var(--accent-violet)";

    this.ui.score.textContent = String(Math.round(this.runStats.score)).padStart(6, "0");
    this.ui.sync.textContent = this.backend.syncStatus;
  }

  render() {
    const ctx = this.ctx;
    const w = CONFIG.LOGICAL_WIDTH;
    const h = CONFIG.LOGICAL_HEIGHT;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
    ctx.lineWidth = 1;
    const step = 40;
    for (let gx = step; gx < w; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = step; gy < h; gy += step) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    const spec = this.chambers[this.chamberIndex];
    if (spec) {
      const mutName = this.activeMutator ? this.activeMutator.name : "Baseline Field";
      ctx.font = "600 12px ui-monospace, monospace";
      ctx.fillStyle = "rgba(143, 161, 189, 0.85)";
      ctx.fillText(`${spec.code} [${mutName}] — ${spec.prompt}`, 24, 28);
    }

    const ex = this.exitPos;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.exitUnlocked ? "rgba(16, 185, 129, 0.16)" : "rgba(100, 116, 139, 0.08)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.setLineDash(this.exitUnlocked ? [] : [6, 6]);
    ctx.strokeStyle = this.exitUnlocked ? "#10b981" : "#64748b";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "700 11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = this.exitUnlocked ? "#34d399" : "#94a3b8";
    ctx.fillText(this.exitUnlocked ? "EXIT OPEN" : "LOCKED", ex.x, ex.y + 4);
    ctx.restore();

    if (this.runStats.pulseWave) {
      const pw = this.runStats.pulseWave;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, pw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(167, 139, 250, ${pw.alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    for (const s of this.shards) {
      if (s.collected) continue;
      const bobY = s.y + Math.sin(s.bobPhase) * 4;
      ctx.save();
      ctx.translate(s.x, bobY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "rgba(251, 191, 36, 0.22)";
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    }

    for (const a of this.anomalies) {
      const ringPulse = Math.sin(a.pulsePhase) * 3;
      ctx.save();
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius + (a.resolved ? 0 : ringPulse), 0, Math.PI * 2);
      if (a.resolved) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
        ctx.strokeStyle = "#10b981";
      } else if (a.flashTimer > 0) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.32)";
        ctx.strokeStyle = "#fde047";
      } else if (a.drift) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
        ctx.strokeStyle = "#38bdf8";
      } else {
        ctx.fillStyle = "rgba(167, 139, 250, 0.14)";
        ctx.strokeStyle = "#a78bfa";
      }
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      ctx.font = "700 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = a.resolved ? "#6ee7b7" : "#e9d5ff";
      ctx.fillText(a.label, a.x, a.y - 2);

      ctx.font = "600 10px ui-monospace, monospace";
      ctx.fillStyle = a.resolved ? "#10b981" : "#cbd5e1";
      const statusText = a.resolved ? "RESOLVED" : a.isDecoy ? "SIGNAL?" : `${a.hits}/${a.hitsNeeded}`;
      ctx.fillText(statusText, a.x, a.y + 12);
      ctx.restore();
    }

    for (const h of this.hazards) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(244, 63, 94, 0.24)";
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.probes) {
      if (p.trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.strokeStyle = p.overdrive ? "rgba(251, 191, 36, 0.55)" : "rgba(56, 189, 248, 0.45)";
        ctx.lineWidth = p.overdrive ? 4.5 : 3;
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.overdrive ? "#fbbf24" : "#7dd3fc";
      ctx.fill();
      ctx.restore();
    }

    const blinkSkip = this.player.invulnTimer > 0 && Math.floor(this.player.invulnTimer * 18) % 2 === 0;
    if (!blinkSkip) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.player.aimAngle);

      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(this.player.radius - 2, -4, 13, 8);

      ctx.beginPath();
      ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#e0f2fe";
      ctx.fill();
      ctx.restore();
    }

    if (this.phase === "playing" && !this.hasOpenModal()) {
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      ctx.lineTo(this.pointer.x, this.pointer.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(this.pointer.x, this.pointer.y, 11, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of this.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      ctx.restore();
    }

    for (const c of this.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life * 1.3);
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    if (this.phase === "playing" && this.runStats.bannerTimer > 0) {
      const alpha = Math.min(1, this.runStats.bannerTimer);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
      ctx.lineWidth = 1;
      const bw = 580;
      const bh = 34;
      const bx = (w - bw) * 0.5;
      const by = 48;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.font = "700 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(this.runStats.bannerText, w * 0.5, by + 21);
      ctx.restore();
    }
  }

  loop(now) {
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const clampedDt = Math.max(0, Math.min(CONFIG.MAX_FRAME_DT, rawDt));

    this.accumulator += clampedDt;
    while (this.accumulator >= CONFIG.FIXED_DT) {
      this.stepSimulation(CONFIG.FIXED_DT);
      this.accumulator -= CONFIG.FIXED_DT;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }
}
