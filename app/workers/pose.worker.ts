/// <reference lib="webworker" />

import type * as poseDetection from "@tensorflow-models/pose-detection";

const ctx = self as DedicatedWorkerGlobalScope;

let detector: poseDetection.PoseDetector | null = null;
let poseModule: typeof import("@tensorflow-models/pose-detection") | null = null;
let tfModule: typeof import("@tensorflow/tfjs") | null = null;
let isReady = false;
let offscreen: OffscreenCanvas | null = null;
let offscreenContext: OffscreenCanvasRenderingContext2D | null = null;
const KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

async function loadDetector(): Promise<poseDetection.PoseDetector> {
  if (detector) {
    return detector;
  }

  if (!tfModule) {
    tfModule = await import("@tensorflow/tfjs");
    await import("@tensorflow/tfjs-backend-webgl");
  }
  if (!poseModule) {
    poseModule = await import("@tensorflow-models/pose-detection");
  }

  try {
    await tfModule.setBackend("webgl");
  } catch (error) {
    await tfModule.setBackend("cpu");
  }
  await tfModule.ready();

  const modelUrl = new URL("/models/movenet/model.json", ctx.location.origin).toString();

  detector = await poseModule.createDetector(
    poseModule.SupportedModels.MoveNet,
    {
      modelType: poseModule.movenet.modelType.SINGLEPOSE_THUNDER,
      modelUrl,
      enableSmoothing: false,
    }
  );

  isReady = true;
  return detector;
}

ctx.onmessage = async (event: MessageEvent) => {
  const data = event.data as {
    type: "FRAME";
    bitmap?: ImageBitmap;
    width?: number;
    height?: number;
    timestamp?: number;
  };

  if (data.type !== "FRAME") {
    return;
  }

  try {
    if (!data.bitmap || !data.width || !data.height) {
      return;
    }

    if (typeof OffscreenCanvas === "undefined") {
      data.bitmap.close();
      return;
    }

    if (!offscreen || offscreen.width !== data.width || offscreen.height !== data.height) {
      offscreen = new OffscreenCanvas(data.width, data.height);
      offscreenContext = offscreen.getContext("2d", { willReadFrequently: true });
    }

    if (!offscreenContext) {
      data.bitmap.close();
      return;
    }

    offscreenContext.drawImage(data.bitmap, 0, 0, data.width, data.height);
    data.bitmap.close();

    const activeDetector = await loadDetector();
    const poses = await activeDetector.estimatePoses(offscreen, {
      flipHorizontal: true,
    });
    const keypoints = poses[0]?.keypoints ?? [];

    ctx.postMessage({
      type: "POSES",
      payload: keypoints.map((point, index) => ({
        name: point.name ?? KEYPOINT_NAMES[index] ?? "",
        x: point.x,
        y: point.y,
        score: point.score ?? 0,
      })),
      timestamp: data.timestamp ?? performance.now(),
      ready: isReady,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pose worker failed.";
    ctx.postMessage({ type: "ERROR", message });
  }
};
