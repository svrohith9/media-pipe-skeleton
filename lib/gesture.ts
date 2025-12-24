export type Gesture = "jump" | "idle" | "flap";

export type PoseThresholds = {
  idleThreshold: number;
  jumpThreshold: number;
};

export type GestureInput = {
  wristY: number;
  wristX: number;
  shoulderY: number;
  thresholds: PoseThresholds | null;
  hasPose: boolean;
  hasWrist: boolean;
  timestamp: number;
};

export type GestureState = {
  mode: "idle" | "raising" | "jump" | "flapping";
  lastTimestamp: number;
  lastAboveIdleTime: number;
  lastWristX: number;
  lastVelocitySign: number;
  flapCycles: number;
  lastFlapTime: number;
};

export const createGestureState = (timestamp: number): GestureState => ({
  mode: "idle",
  lastTimestamp: timestamp,
  lastAboveIdleTime: 0,
  lastWristX: 0,
  lastVelocitySign: 0,
  flapCycles: 0,
  lastFlapTime: 0,
});

export function updateGesture(
  prev: GestureState,
  input: GestureInput
): { state: GestureState; gesture: Gesture } {
  if (!input.hasPose || !input.hasWrist) {
    return { state: { ...prev, mode: "idle" }, gesture: "idle" };
  }

  const dt = Math.max(0.001, (input.timestamp - prev.lastTimestamp) / 1000);
  const velocityX = (input.wristX - prev.lastWristX) / dt;
  const velocitySign = Math.sign(velocityX);
  const idleThreshold = input.thresholds?.idleThreshold ?? input.shoulderY + 0.1;
  const jumpThreshold =
    input.thresholds?.jumpThreshold ?? input.shoulderY - 0.05;

  let nextState: GestureState = {
    ...prev,
    lastTimestamp: input.timestamp,
    lastWristX: input.wristX,
  };

  let gesture: Gesture = "idle";

  if (input.wristY > idleThreshold) {
    nextState.lastAboveIdleTime = input.timestamp;
  }

  if (
    input.wristY <= jumpThreshold &&
    input.timestamp - nextState.lastAboveIdleTime < 300
  ) {
    nextState.mode = "jump";
    gesture = "jump";
    nextState.flapCycles = 0;
  } else if (Math.abs(velocityX) > 200 && input.wristY >= idleThreshold) {
    if (velocitySign !== 0 && velocitySign !== nextState.lastVelocitySign) {
      nextState.flapCycles += 1;
      nextState.lastVelocitySign = velocitySign;
      nextState.lastFlapTime = input.timestamp;
    }

    if (nextState.flapCycles >= 3) {
      nextState.mode = "flapping";
      gesture = "flap";
    }
  }

  if (input.timestamp - nextState.lastFlapTime > 1000) {
    nextState.flapCycles = 0;
  }

  if (gesture === "idle" && nextState.mode !== "idle") {
    nextState.mode = "idle";
  }

  return { state: nextState, gesture };
}

export function getGestureConfidence(
  gesture: Gesture,
  velocityX: number,
  wristY: number,
  thresholds: PoseThresholds | null
): number {
  if (!thresholds) {
    return 0.2;
  }
  if (gesture === "jump") {
    return Math.min(1, Math.max(0, (thresholds.jumpThreshold - wristY + 0.1) * 4));
  }
  if (gesture === "flap") {
    return Math.min(1, Math.max(0, (Math.abs(velocityX) - 200) / 300));
  }
  return 0.1;
}

type MovementSample = {
  x: number;
  y: number;
  timestamp: number;
};

export class MovementClassifier {
  private wristHistory: MovementSample[] = [];
  private readonly HISTORY_SIZE = 10;

  classify(keypoints: { name: string; x: number; y: number; score: number }[]):
    | "JUMP"
    | "FLAP"
    | "IDLE"
    | "ERROR" {
    const wrist =
      keypoints.find((point) => point.name === "left_wrist") ??
      keypoints.find((point) => point.name === "right_wrist");
    if (!wrist) {
      console.error("[Gesture] ❌ No wrist keypoint found");
      return "ERROR";
    }

    if (wrist.score < 0.3) {
      console.warn("[Gesture] ⚠️ Low wrist confidence:", wrist.score);
      return "ERROR";
    }

    const timestamp = performance.now();
    this.wristHistory.push({ x: wrist.x, y: wrist.y, timestamp });
    if (this.wristHistory.length > this.HISTORY_SIZE) {
      this.wristHistory.shift();
    }

    if (this.wristHistory.length < 3) {
      console.log("[Gesture] ⏳ Collecting samples...");
      return "IDLE";
    }

    const recent = this.wristHistory.slice(-3);
    const velocityY =
      (recent[2].y - recent[0].y) /
      (recent[2].timestamp - recent[0].timestamp);
    const velocityX =
      (recent[2].x - recent[0].x) /
      (recent[2].timestamp - recent[0].timestamp);

    console.log(
      "[Gesture] Velocity Y:",
      velocityY.toFixed(2),
      "X:",
      velocityX.toFixed(2)
    );

    if (velocityY < -0.5) {
      console.log("[Gesture] ✅ JUMP detected");
      return "JUMP";
    }

    const varianceX = this.calculateVariance(
      this.wristHistory.map((point) => point.x)
    );
    if (varianceX > 50 && Math.abs(velocityX) > 0.3) {
      console.log("[Gesture] ✅ FLAP detected");
      return "FLAP";
    }

    return "IDLE";
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return (
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length
    );
  }
}
