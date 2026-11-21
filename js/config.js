export const CONFIG = Object.freeze({
  LOGICAL_WIDTH: 1120,
  LOGICAL_HEIGHT: 620,
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.05,
  STORAGE_KEY_STATE: "curiosity_engine_state_v1",
  STORAGE_KEY_EVENTS: "curiosity_engine_events_v1",
  STORAGE_KEY_QUEUE: "curiosity_engine_sync_queue_v1",
  STORAGE_KEY_CLIENT_ID: "curiosity_engine_client_id_v1",
  MAX_STORED_EVENTS: 250,
  MAX_SYNC_QUEUE: 100,
  BACKEND: Object.freeze({
    DEFAULT_BASE_URL: "http://localhost:8787",
    HEALTH_CHECK_MS: 12000,
    REQUEST_TIMEOUT_MS: 3200
  }),
  PLAYER: Object.freeze({
    START_X: 145,
    START_Y: 310,
    RADIUS: 17,
    SPEED: 255,
    MAX_INTEGRITY: 100,
    MAX_PROBE_CHARGE: 100,
    PROBE_COST: 18,
    OVERDRIVE_COST: 34,
    FIRE_COOLDOWN: 0.2,
    OVERDRIVE_COOLDOWN: 0.45,
    PROBE_SPEED: 640,
    OVERDRIVE_SPEED: 860,
    PROBE_LIFE: 1.35,
    OVERDRIVE_LIFE: 1.6,
    PULSE_COST: 35,
    PULSE_COOLDOWN: 1.6,
    PULSE_RADIUS: 230,
    SHARD_ATTRACT_RANGE: 260,
    INVULN_DURATION: 0.85
  }),
  MUTATORS: Object.freeze([
    Object.freeze({
      id: "base_resonance",
      name: "Baseline Field",
      summary: "Standard probe physics and room resonance.",
      hazardSpeedMult: 1.0,
      probeSpeedMult: 1.0,
      curiosityMult: 1.0,
      scoreMult: 1.0
    }),
    Object.freeze({
      id: "high_velocity",
      name: "Kinetic Surge",
      summary: "Probes travel 20% faster; hazard orbits spin 12% faster.",
      hazardSpeedMult: 1.12,
      probeSpeedMult: 1.2,
      curiosityMult: 1.1,
      scoreMult: 1.15
    }),
    Object.freeze({
      id: "curiosity_amplified",
      name: "Deep Curiosity",
      summary: "+25% curiosity gain and +20% score; hazards spin 15% faster.",
      hazardSpeedMult: 1.15,
      probeSpeedMult: 1.05,
      curiosityMult: 1.25,
      scoreMult: 1.2
    }),
    Object.freeze({
      id: "precision_lens",
      name: "Calibrated Optics",
      summary: "Overdrive probes pierce deeper with +15% score bonus.",
      hazardSpeedMult: 1.05,
      probeSpeedMult: 1.15,
      curiosityMult: 1.05,
      scoreMult: 1.2
    })
  ]),
  MODES: Object.freeze({
    calm: Object.freeze({
      label: "Calm Observer",
      hazardDamageScale: 0.7,
      probeRegenPerSec: 36,
      curiosityGainScale: 1.0,
      scoreMultiplier: 0.85
    }),
    standard: Object.freeze({
      label: "Standard Probe",
      hazardDamageScale: 1.0,
      probeRegenPerSec: 28,
      curiosityGainScale: 1.15,
      scoreMultiplier: 1.0
    }),
    volatile: Object.freeze({
      label: "Volatile Surge",
      hazardDamageScale: 1.35,
      probeRegenPerSec: 24,
      curiosityGainScale: 1.4,
      scoreMultiplier: 1.35
    })
  })
});
