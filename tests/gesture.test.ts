import { describe, expect, it } from "vitest";
import {
  createGestureState,
  updateGesture,
  type PoseThresholds,
} from "../lib/gesture";

describe("updateGesture", () => {
  const thresholds: PoseThresholds = {
    idleThreshold: 0.75,
    jumpThreshold: 0.35,
  };

  it("stays idle without pose", () => {
    const result = updateGesture(createGestureState(0), {
      wristY: 0.5,
      wristX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: false,
      hasWrist: false,
      timestamp: 100,
    });
    expect(result.gesture).toBe("idle");
  });

  it("detects jump when wrist crosses threshold quickly", () => {
    const state = createGestureState(0);
    const mid = updateGesture(state, {
      wristY: 0.8,
      wristX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
      timestamp: 50,
    }).state;

    const result = updateGesture(mid, {
      wristY: 0.3,
      wristX: 0,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
      timestamp: 200,
    });

    expect(result.gesture).toBe("jump");
  });

  it("detects flap after oscillations", () => {
    let state = createGestureState(0);
    const timestamps = [100, 150, 200, 250, 300, 350];
    const xs = [0, 50, -50, 60, -60, 70];

    for (let i = 0; i < xs.length; i += 1) {
      const result = updateGesture(state, {
        wristY: 0.8,
        wristX: xs[i],
        shoulderY: 0.5,
        thresholds,
        hasPose: true,
        hasWrist: true,
        timestamp: timestamps[i],
      });
      state = result.state;
    }

    const final = updateGesture(state, {
      wristY: 0.8,
      wristX: -70,
      shoulderY: 0.5,
      thresholds,
      hasPose: true,
      hasWrist: true,
      timestamp: 400,
    });

    expect(final.gesture).toBe("flap");
  });
});
