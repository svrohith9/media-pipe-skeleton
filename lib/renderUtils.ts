import type { PoseKeypoint } from "./pose";
import { KEYPOINT_EDGES } from "./keypointEdges";

export function drawSkeleton(
  keypoints: PoseKeypoint[],
  ctx: CanvasRenderingContext2D,
  scale = 1
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineWidth = 2;
  for (const point of keypoints) {
    if (point.score < 0.3) {
      continue;
    }
    ctx.beginPath();
    ctx.arc(point.x * scale, point.y * scale, 4, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${point.score * 120}, 100%, 50%)`;
    ctx.fill();
  }

  for (const [start, end] of KEYPOINT_EDGES) {
    const startKp = keypoints[start];
    const endKp = keypoints[end];
    if (!startKp || !endKp || startKp.score < 0.3 || endKp.score < 0.3) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(startKp.x * scale, startKp.y * scale);
    ctx.lineTo(endKp.x * scale, endKp.y * scale);
    const confidence = Math.min(startKp.score, endKp.score);
    ctx.strokeStyle = `hsl(${confidence * 120}, 100%, 50%)`;
    ctx.stroke();
  }
}

export function drawVideo(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D
): void {
  ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
}
