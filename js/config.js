export const CONFIG = Object.freeze({
  LOGICAL_WIDTH: 1120,
  LOGICAL_HEIGHT: 620,
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.05,
  STORAGE_KEY_STATE: "curiosity_engine_state_v1",
  STORAGE_KEY_EVENTS: "curiosity_engine_events_v1",
  MAX_STORED_EVENTS: 250,
  PLAYER: Object.freeze({
    START_X: 145,
    START_Y: 310,
    RADIUS: 17,
    SPEED: 255,
    MAX_INTEGRITY: 100,
    MAX_PROBE_CHARGE: 100,
    PROBE_COST: 18,
    FIRE_COOLDOWN: 0.2,
    PROBE_SPEED: 640,
    PROBE_LIFE: 1.35,
    PULSE_COST: 35,
    PULSE_COOLDOWN: 1.6,
    PULSE_RADIUS: 230,
    SHARD_ATTRACT_RANGE: 260,
    INVULN_DURATION: 0.85
  }),
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

