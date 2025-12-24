import { test, expect } from "@playwright/test";

type PoseKeypoint = {
  name: string;
  x: number;
  y: number;
  score: number;
};

const buildKeypoints = (wristY: number, wristX = 320): PoseKeypoint[] => [
  { name: "right_shoulder", x: 320, y: 160, score: 0.9 },
  { name: "right_elbow", x: 320, y: 220, score: 0.9 },
  { name: "right_wrist", x: wristX, y: wristY, score: 0.9 },
  { name: "left_shoulder", x: 280, y: 160, score: 0.8 },
  { name: "left_elbow", x: 280, y: 220, score: 0.8 },
  { name: "left_wrist", x: 280, y: wristY, score: 0.8 },
];

const pumpFrames = async (page: import("@playwright/test").Page, wristY: number, wristX = 320) => {
  for (let i = 0; i < 32; i += 1) {
    await page.evaluate((keypoints) => {
      window.__setMockPose?.(keypoints);
    }, buildKeypoints(wristY, wristX));
    await page.waitForTimeout(16);
  }
};

test("calibration, jumps, pause, resume", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("calibration")).toBeVisible();
  await pumpFrames(page, 300);
  await pumpFrames(page, 120);

  await expect(page.getByText("Calibrated!")).toBeVisible();
  await page.waitForTimeout(600);

  const debugCanvas = page.getByTestId("skeleton-debug");
  await expect(debugCanvas).toBeVisible();
  const hasInk = await debugCanvas.evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return false;
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) {
        return true;
      }
    }
    return false;
  });
  expect(hasInk).toBe(true);

  await pumpFrames(page, 120);
  await page.waitForTimeout(120);
  await pumpFrames(page, 120, 360);
  await page.waitForTimeout(120);
  await pumpFrames(page, 120, 280);

  const scoreCard = page.getByText("Score");
  await expect(scoreCard).toBeVisible();
  const scoreValue = page.locator("div", { hasText: "Score" }).locator(".font-mono").first();
  await expect(scoreValue).not.toHaveText("0", { timeout: 15000 });

  await page.evaluate(() => {
    window.__setMockPose?.([]);
  });
  await page.waitForTimeout(2200);
  await expect(page.getByText("Camera lost")).toBeVisible();

  await page.getByRole("button", { name: "Resume" }).click();
  await pumpFrames(page, 300);
  await expect(page.getByText("Camera lost")).not.toBeVisible();
});
