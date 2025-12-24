export type PreflightResult = {
  camera: boolean;
  stream: MediaStream | null;
  worker: boolean;
  model: boolean;
  offscreenCanvas: boolean;
};

export async function runPreflightCheck(): Promise<PreflightResult> {
  const results: PreflightResult = {
    camera: false,
    stream: null,
    worker: false,
    model: false,
    offscreenCanvas: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: 30 },
      audio: false,
    });
    results.camera = true;
    results.stream = stream;
    console.log("[Preflight] ✅ Camera granted");
  } catch (error) {
    console.error("[Preflight] ❌ Camera denied:", error);
    throw new Error("CAMERA_ACCESS_DENIED");
  }

  results.offscreenCanvas = typeof OffscreenCanvas !== "undefined";
  if (!results.offscreenCanvas) {
    console.error("[Preflight] ❌ OffscreenCanvas not supported");
    throw new Error("OFFSCREEN_CANVAS_UNSUPPORTED");
  }

  try {
    const testWorker = new Worker(
      URL.createObjectURL(new Blob(["postMessage('test')"]))
    );
    const ok = await new Promise<boolean>((resolve) => {
      let settled = false;
      testWorker.onmessage = () => {
        settled = true;
        resolve(true);
      };
      setTimeout(() => {
        if (!settled) {
          resolve(false);
        }
      }, 1000);
    });
    testWorker.terminate();
    if (!ok) {
      throw new Error("WORKER_TIMEOUT");
    }
    results.worker = true;
    console.log("[Preflight] ✅ Web Workers functional");
  } catch (error) {
    console.error("[Preflight] ❌ Web Workers blocked", error);
    throw new Error("WEB_WORKER_BLOCKED");
  }

  return results;
}
