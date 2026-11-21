
export function buildChambers() {
  return [
    {
      index: 1,
      code: "CHAMBER-01 // THE QUIET LOCK",
      title: "The Unlabeled Switchboard",
      prompt: "Three dormant nodes hum softly. Probe each node to expose its true polarity and unlock the gate.",
      exitPos: { x: 990, y: 310 },
      anomalies: [
        { id: "c1-a1", x: 430, y: 180, radius: 28, kind: "switch_node", label: "ALPHA", hitsNeeded: 1, curiosityReward: 18 },
        { id: "c1-a2", x: 560, y: 320, radius: 28, kind: "switch_node", label: "BETA", hitsNeeded: 1, curiosityReward: 18 },
        { id: "c1-a3", x: 440, y: 460, radius: 28, kind: "switch_node", label: "GAMMA", hitsNeeded: 1, curiosityReward: 22 }
      ],
      shards: [
        { id: "c1-s1", x: 310, y: 210, value: 250 },
        { id: "c1-s2", x: 710, y: 220, value: 300 },
        { id: "c1-s3", x: 720, y: 420, value: 350 }
      ],
      hazards: [
        { id: "c1-h1", cx: 560, cy: 190, orbitRadius: 72, speed: 1.4, angle: 0.4, radius: 14, damage: 14 },
        { id: "c1-h2", cx: 690, cy: 320, orbitRadius: 85, speed: -1.2, angle: 2.1, radius: 14, damage: 14 }
      ]
    },
    {
      index: 2,
      code: "CHAMBER-02 // MIRRORED ECHO",
      title: "The Double-Truth Relay",
      prompt: "Some anomalies require two calibrated probes to stabilize. Watch for orbiting distortion rings.",
      exitPos: { x: 1005, y: 170 },
      anomalies: [
        { id: "c2-a1", x: 360, y: 165, radius: 30, kind: "relay_node", label: "ECHO-1", hitsNeeded: 2, curiosityReward: 22 },
        { id: "c2-a2", x: 540, y: 455, radius: 30, kind: "relay_node", label: "ECHO-2", hitsNeeded: 2, curiosityReward: 24 },
        { id: "c2-a3", x: 760, y: 270, radius: 32, kind: "relay_node", label: "ECHO-3", hitsNeeded: 2, curiosityReward: 28 }
      ],
      shards: [
        { id: "c2-s1", x: 250, y: 430, value: 350 },
        { id: "c2-s2", x: 540, y: 250, value: 400 },
        { id: "c2-s3", x: 860, y: 440, value: 450 }
      ],
      hazards: [
        { id: "c2-h1", cx: 450, cy: 310, orbitRadius: 95, speed: 1.75, angle: 0.0, radius: 15, damage: 16 },
        { id: "c2-h2", cx: 680, cy: 360, orbitRadius: 90, speed: -1.65, angle: 1.5, radius: 15, damage: 16 },
        { id: "c2-h3", cx: 830, cy: 175, orbitRadius: 65, speed: 2.0, angle: 3.1, radius: 13, damage: 15 }
      ]
    },
    {
      index: 3,
      code: "CHAMBER-03 // PARADOX VAULT",
      title: "The Shifting Seal",
      prompt: "High curiosity intensifies the room's resonance. Probe all four seal cores and reach the eastern threshold.",
      exitPos: { x: 1010, y: 310 },
      anomalies: [
        { id: "c3-a1", x: 350, y: 160, radius: 26, kind: "seal_core", label: "SEAL-N", hitsNeeded: 2, curiosityReward: 20 },
        { id: "c3-a2", x: 350, y: 460, radius: 26, kind: "seal_core", label: "SEAL-S", hitsNeeded: 2, curiosityReward: 20 },
        { id: "c3-a3", x: 640, y: 180, radius: 28, kind: "seal_core", label: "SEAL-E1", hitsNeeded: 2, curiosityReward: 25 },
        { id: "c3-a4", x: 640, y: 440, radius: 28, kind: "seal_core", label: "SEAL-E2", hitsNeeded: 2, curiosityReward: 25 }
      ],
      shards: [
        { id: "c3-s1", x: 495, y: 310, value: 500 },
        { id: "c3-s2", x: 780, y: 160, value: 450 },
        { id: "c3-s3", x: 780, y: 460, value: 450 }
      ],
      hazards: [
        { id: "c3-h1", cx: 495, cy: 200, orbitRadius: 85, speed: 2.1, angle: 0.5, radius: 15, damage: 17 },
        { id: "c3-h2", cx: 495, cy: 420, orbitRadius: 85, speed: -2.1, angle: 2.2, radius: 15, damage: 17 },
        { id: "c3-h3", cx: 820, cy: 310, orbitRadius: 105, speed: 1.9, angle: 1.1, radius: 16, damage: 18 }
      ]
    },
    {
      index: 4,
      code: "CHAMBER-04 // FINAL THRESHOLD",
      title: "The Core Question",
      prompt: "Final chamber: resolve every core anomaly to unseal the exit and answer the room.",
      exitPos: { x: 1015, y: 310 },
      anomalies: [
        { id: "c4-a1", x: 380, y: 200, radius: 28, kind: "omega_core", label: "PRIME-I", hitsNeeded: 2, curiosityReward: 25 },
        { id: "c4-a2", x: 380, y: 420, radius: 28, kind: "omega_core", label: "PRIME-II", hitsNeeded: 2, curiosityReward: 25 },
        { id: "c4-a3", x: 600, y: 310, radius: 34, kind: "omega_core", label: "NEXUS", hitsNeeded: 3, curiosityReward: 35 },
        { id: "c4-a4", x: 800, y: 210, radius: 26, kind: "omega_core", label: "AXIS-A", hitsNeeded: 2, curiosityReward: 25 },
        { id: "c4-a5", x: 800, y: 410, radius: 26, kind: "omega_core", label: "AXIS-B", hitsNeeded: 2, curiosityReward: 25 }
      ],
      shards: [
        { id: "c4-s1", x: 250, y: 310, value: 600 },
        { id: "c4-s2", x: 600, y: 135, value: 650 },
        { id: "c4-s3", x: 600, y: 485, value: 650 }
      ],
      hazards: [
        { id: "c4-h1", cx: 490, cy: 310, orbitRadius: 110, speed: 2.25, angle: 0.2, radius: 15, damage: 18 },
        { id: "c4-h2", cx: 705, cy: 310, orbitRadius: 110, speed: -2.25, angle: 2.6, radius: 15, damage: 18 },
        { id: "c4-h3", cx: 600, cy: 310, orbitRadius: 165, speed: 1.55, angle: 4.1, radius: 16, damage: 18 }
      ]
    }
  ];
}
