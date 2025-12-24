"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import Calibration, { type CalibrationResult } from "./Calibration";
import Player from "./Player";
import Obstacle from "./Obstacle";
import ParallaxBg from "./ParallaxBg";
import Hud from "./Hud";
import PauseModal from "./PauseModal";
import GameOverModal from "./GameOverModal";
import { usePose } from "../../hooks/usePose";
import { useGameLoop } from "../../hooks/useGameLoop";
import {
  createGestureState,
  updateGesture,
  type GestureState,
} from "../../lib/gesture";
import { aabbIntersect, integrateJump, type JumpState } from "../../lib/physics";
import {
  clearThresholds,
  loadHighScore,
  loadThresholds,
  saveHighScore,
  saveThresholds,
} from "../../lib/storage";
import { useGameStore } from "../../store/gameStore";

const PLAYER_X = 120;
const PLAYER_SIZE = 56;
const WORLD_SPEED = 260;
const GRAVITY = 2000;
const JUMP_IMPULSE = 800;

const slideUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: 40, transition: { duration: 0.2, ease: "easeIn" } },
};

type ObstacleItem = {
  id: number;
  x: number;
  y: number;
  height: number;
  type: "low" | "high";
  active: boolean;
  scored: boolean;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

export default function GameStage() {
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState("Camera lost");
  const [isGameOver, setIsGameOver] = useState(false);
  const [distance, setDistance] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [hitFlash, setHitFlash] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const thresholds = useGameStore((state) => state.thresholds);
  const setThresholds = useGameStore((state) => state.setThresholds);
  const score = useGameStore((state) => state.score);
  const setScore = useGameStore((state) => state.setScore);
  const combo = useGameStore((state) => state.combo);
  const setCombo = useGameStore((state) => state.setCombo);
  const highScore = useGameStore((state) => state.highScore);
  const setHighScore = useGameStore((state) => state.setHighScore);
  const resetScore = useGameStore((state) => state.resetScore);
  const preferKeyboard = useGameStore((state) => state.preferKeyboard);
  const setPreferKeyboard = useGameStore((state) => state.setPreferKeyboard);
  const setCalibrationStats = useGameStore(
    (state) => state.setCalibrationStats
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const stageWidthRef = useRef(900);

  const playerY = useMotionValue(0);
  const playerSquish = useMotionValue(1);
  const shakeX = useMotionValue(0);
  const worldX = useMotionValue(0);

  const playerRef = useRef<JumpState>({ y: 0, vy: 0, grounded: true });
  const previousGroundedRef = useRef(true);
  const lastPoseTimeRef = useRef(0);
  const lastJumpTimeRef = useRef(0);
  const jumpStreakRef = useRef(0);
  const slowMoUntilRef = useRef(0);
  const shakeTimerRef = useRef(0);
  const spawnTimerRef = useRef(1.5);
  const hitLockRef = useRef(false);
  const gestureStateRef = useRef<GestureState>(createGestureState(0));
  const keyboardJumpRef = useRef(false);
  const keyboardFlapRef = useRef(false);
  const lastArrowRef = useRef<"up" | "down" | null>(null);
  const lastArrowTimeRef = useRef(0);
  const [gestureIndicator, setGestureIndicator] = useState<"jump" | "flap" | null>(null);

  const obstaclePool = useMemo<ObstacleItem[]>(() => {
    return Array.from({ length: 12 }).map((_, index) => ({
      id: index,
      x: 0,
      y: 0,
      height: 0,
      type: "high",
      active: false,
      scored: false,
    }));
  }, []);

  const [obstacles, setObstacles] = useState<ObstacleItem[]>(obstaclePool);
  const obstaclesRef = useRef<ObstacleItem[]>(obstaclePool);

  const particlePool = useMemo<Particle[]>(() => {
    return Array.from({ length: 30 }).map((_, index) => ({
      id: index,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
    }));
  }, []);

  const particlesRef = useRef<Particle[]>(particlePool);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const {
    keypoints,
    hasPose,
    hasWrist,
    shoulderNormalizedY,
    isModelReady,
    cameraStatus,
    fps,
    wristFiltered,
    wristFilteredNormalizedY,
    wristNormalizedY,
    videoRef,
    overlayRef,
  } = usePose({
    enabled: true,
    onError: (message) => setToast(message),
  });

  const jumpReady =
    !preferKeyboard &&
    !!thresholds &&
    wristFilteredNormalizedY > 0 &&
    wristFilteredNormalizedY <= thresholds.jumpThreshold + 0.05;

  useEffect(() => {
    const stored = loadThresholds();
    setThresholds(stored);
    setIsCalibrating(!stored);
    const storedHigh = loadHighScore();
    setHighScore(storedHigh);
  }, [setHighScore, setThresholds]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isCalibrating) {
      setToast("Calibrating...");
      return;
    }
    setToast("Ready!");
  }, [isCalibrating]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!gestureIndicator) {
      return;
    }
    const timeout = window.setTimeout(() => setGestureIndicator(null), 400);
    return () => window.clearTimeout(timeout);
  }, [gestureIndicator]);

  useEffect(() => {
    if (cameraStatus === "denied") {
      setPreferKeyboard(true);
      setToast("Camera unavailable. Keyboard controls enabled.");
    }
  }, [cameraStatus, setPreferKeyboard]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        keyboardJumpRef.current = true;
      }
      if (event.code === "ArrowUp") {
        const now = performance.now();
        if (
          lastArrowRef.current === "down" &&
          now - lastArrowTimeRef.current < 400
        ) {
          keyboardFlapRef.current = true;
        }
        lastArrowRef.current = "up";
        lastArrowTimeRef.current = now;
      }
      if (event.code === "ArrowDown") {
        const now = performance.now();
        if (
          lastArrowRef.current === "up" &&
          now - lastArrowTimeRef.current < 400
        ) {
          keyboardFlapRef.current = true;
        }
        lastArrowRef.current = "down";
        lastArrowTimeRef.current = now;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        keyboardJumpRef.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const resize = () => {
      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        stageWidthRef.current = rect.width;
        if (particleCanvasRef.current) {
          particleCanvasRef.current.width = rect.width;
          particleCanvasRef.current.height = rect.height;
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!hasPose) {
      return;
    }

    lastPoseTimeRef.current = performance.now();
    if (isPaused && pauseReason === "Camera lost") {
      setIsPaused(false);
    }
  }, [hasPose, isPaused, pauseReason]);

  const emitParticles = useCallback((originX: number, originY: number, burst = 12) => {
    const pool = particlesRef.current;
    const maxBurst = prefersReducedMotion ? Math.min(3, burst) : burst;
    let emitted = 0;
    for (const particle of pool) {
      if (particle.life <= 0 && emitted < maxBurst) {
        particle.x = originX;
        particle.y = originY;
        particle.vx = (Math.random() - 0.5) * 140;
        particle.vy = 80 + Math.random() * 120;
        particle.life = 0.6 + Math.random() * 0.4;
        emitted += 1;
      }
    }
  }, [prefersReducedMotion]);

  const spawnObstacle = useCallback(() => {
    const pool = obstaclesRef.current;
    const inactive = pool.find((item) => !item.active);
    if (!inactive) {
      return;
    }

    const type = Math.random() > 0.55 ? "high" : "low";
    inactive.type = type;
    inactive.active = true;
    inactive.scored = false;
    inactive.x = stageWidthRef.current + 120;
    if (type === "high") {
      inactive.height = 84;
      inactive.y = 0;
    } else {
      inactive.height = 24;
      inactive.y = PLAYER_SIZE + 26;
    }

    setObstacles([...pool]);
  }, []);

  const resetGame = useCallback(() => {
    playerRef.current = { y: 0, vy: 0, grounded: true };
    previousGroundedRef.current = true;
    worldX.set(0);
    spawnTimerRef.current = 1.5;
    lastJumpTimeRef.current = 0;
    jumpStreakRef.current = 0;
    slowMoUntilRef.current = 0;
    hitLockRef.current = false;
    gestureStateRef.current = createGestureState(performance.now());
    resetScore();
    setDistance(0);
    setIsGameOver(false);
    setHitFlash(false);

    const pool = obstaclesRef.current;
    for (const item of pool) {
      item.active = false;
      item.scored = false;
      item.x = stageWidthRef.current + 120;
    }
    setObstacles([...pool]);

    const particlePoolLocal = particlesRef.current;
    for (const particle of particlePoolLocal) {
      particle.life = 0;
    }
  }, [resetScore, worldX]);

  useGameLoop(
    useCallback(
      (dt, time) => {
        try {
          if (isPaused || isGameOver || isCalibrating) {
            return;
          }

          const lastPoseTime = lastPoseTimeRef.current;
          if (!hasPose && time - lastPoseTime > 2000 && !preferKeyboard && cameraStatus !== "denied") {
            setIsPaused(true);
            setPauseReason("Camera lost");
            setToast("Camera lost");
            return;
          }

          const slowMo = time < slowMoUntilRef.current;
          const effectiveDt = slowMo ? dt * 0.35 : dt;

          worldX.set(worldX.get() + WORLD_SPEED * effectiveDt);
          setDistance(Math.floor(worldX.get() / 80));

          const currentThresholds = thresholds;
          let gesture: "idle" | "jump" | "flap" = "idle";
          const usingKeyboard = preferKeyboard || cameraStatus === "denied";

          if (usingKeyboard) {
            if (keyboardJumpRef.current) {
              gesture = "jump";
              keyboardJumpRef.current = false;
            } else if (keyboardFlapRef.current) {
              gesture = "flap";
              keyboardFlapRef.current = false;
            }
          } else if (wristFiltered) {
            const result = updateGesture(gestureStateRef.current, {
              wristY: wristFilteredNormalizedY,
              wristX: wristFiltered.x,
              shoulderY: shoulderNormalizedY,
              thresholds: currentThresholds,
              hasPose,
              hasWrist,
              timestamp: time,
            });
            gestureStateRef.current = result.state;
            gesture = result.gesture;
          }

          if (gesture === "jump" && playerRef.current.grounded) {
            playerRef.current.vy = JUMP_IMPULSE;
            playerRef.current.grounded = false;
            lastJumpTimeRef.current = time;
            jumpStreakRef.current += 1;
            const nextCombo = jumpStreakRef.current >= 3 ? 1.5 : 1;
            setCombo(nextCombo);
            emitParticles(PLAYER_X + 20, 80, 12);
            setGestureIndicator("jump");
          }

          if (gesture === "flap") {
            if (!prefersReducedMotion) {
              shakeTimerRef.current = 0.25;
            }
            emitParticles(PLAYER_X + 20, 80, 8);
            setGestureIndicator("flap");
          }

          if (time - lastJumpTimeRef.current > 1500) {
            jumpStreakRef.current = 0;
            setCombo(1);
          }

          const nextJump = integrateJump(playerRef.current, effectiveDt, GRAVITY);
          playerRef.current = nextJump;
          playerY.set(-nextJump.y);

          if (nextJump.grounded && !previousGroundedRef.current) {
            animate(playerSquish, 0.98, { duration: 0.05 });
            animate(playerSquish, 1, { duration: 0.12, delay: 0.05 });
          }
          previousGroundedRef.current = nextJump.grounded;

          if (prefersReducedMotion) {
            shakeTimerRef.current = 0;
            shakeX.set(0);
          } else if (shakeTimerRef.current > 0) {
            shakeTimerRef.current -= effectiveDt;
            const magnitude = 4 * (shakeTimerRef.current / 0.25);
            shakeX.set((Math.random() - 0.5) * magnitude);
          } else {
            shakeX.set(0);
          }

          spawnTimerRef.current -= effectiveDt;
          const difficulty = Math.exp(-worldX.get() / 2500);
          const spawnInterval = Math.max(0.6, 1.6 * difficulty + 0.4);
          if (spawnTimerRef.current <= 0) {
            spawnObstacle();
            spawnTimerRef.current = spawnInterval;
          }

          const pool = obstaclesRef.current;
          for (const item of pool) {
            if (!item.active) {
              continue;
            }

            item.x -= WORLD_SPEED * effectiveDt;
            if (item.x < -80) {
              item.active = false;
              item.scored = false;
              continue;
            }

            if (!item.scored && item.x < PLAYER_X - 10) {
              item.scored = true;
              const nextScore = score + combo;
              setScore(nextScore);
              if (nextScore > highScore) {
                const roundedHigh = Math.floor(nextScore);
                setHighScore(roundedHigh);
                saveHighScore(roundedHigh);
              }
            }

            const playerBox = {
              x: PLAYER_X,
              y: playerRef.current.y,
              width: PLAYER_SIZE,
              height: PLAYER_SIZE,
            };
            const obstacleBox = {
              x: item.x,
              y: item.y,
              width: 48,
              height: item.height,
            };

            if (aabbIntersect(playerBox, obstacleBox) && !hitLockRef.current) {
              hitLockRef.current = true;
              setHitFlash(true);
              slowMoUntilRef.current = time + 500;
              setTimeout(() => {
                setIsGameOver(true);
                setHitFlash(false);
              }, 520);
            }
          }
          setObstacles([...pool]);

          const particlePoolLocal = particlesRef.current;
          for (const particle of particlePoolLocal) {
            if (particle.life <= 0) {
              continue;
            }
            particle.life -= effectiveDt;
            particle.x += particle.vx * effectiveDt;
            particle.y += particle.vy * effectiveDt;
            particle.vy -= 220 * effectiveDt;
          }

          const particleCanvas = particleCanvasRef.current;
          if (particleCanvas) {
            const context = particleCanvas.getContext("2d");
            if (context) {
              context.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
              for (const particle of particlePoolLocal) {
                if (particle.life <= 0) {
                  continue;
                }
                context.globalAlpha = Math.max(0, Math.min(1, particle.life));
                context.fillStyle = "#ffffff";
                context.beginPath();
                context.arc(particle.x, particleCanvas.height - particle.y, 2, 0, Math.PI * 2);
                context.fill();
              }
              context.globalAlpha = 1;
            }
          }
        } catch (error) {
          console.error("[GameError]", error);
          setToast("Something went wrong. Please try again.");
          setIsPaused(true);
          setPauseReason("Unexpected error");
        }
      },
      [
        combo,
        emitParticles,
        hasPose,
        hasWrist,
        highScore,
        isCalibrating,
        isGameOver,
        isPaused,
        cameraStatus,
        preferKeyboard,
        playerSquish,
        playerY,
        prefersReducedMotion,
        score,
        setCombo,
        setHighScore,
        setScore,
        spawnObstacle,
        thresholds,
        worldX,
        wristFiltered,
        wristFilteredNormalizedY,
        shoulderNormalizedY,
      ]
    ),
    !isPaused && !isGameOver && !isCalibrating
  );

  const handleCalibrationComplete = useCallback(
    (result: CalibrationResult) => {
      saveThresholds(result.thresholds);
      setThresholds(result.thresholds);
      setCalibrationStats(result.stats);
      setTimeout(() => {
        setIsCalibrating(false);
      }, 400);
    },
    [setCalibrationStats, setThresholds]
  );

  const handleSkipCalibration = useCallback(() => {
    const fallback = { idleThreshold: 0.75, jumpThreshold: 0.35 };
    saveThresholds(fallback);
    setThresholds(fallback);
    setCalibrationStats({
      lowMean: 0.75,
      lowStd: 0.08,
      highMean: 0.35,
      highStd: 0.08,
    });
    setIsCalibrating(false);
  }, [setCalibrationStats, setThresholds]);

  const handleRecalibrate = () => {
    clearThresholds();
    setThresholds(null);
    setCalibrationStats(null);
    setIsCalibrating(true);
  };

  const handleResume = () => {
    lastPoseTimeRef.current = performance.now();
    setIsPaused(false);
  };

  const handleQuit = () => {
    resetGame();
    setIsPaused(false);
  };

  const handleReplay = () => {
    resetGame();
    setIsPaused(false);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden text-cyan-200">
      <motion.div
        ref={stageRef}
        className="relative h-full w-full"
        style={{ translateX: shakeX }}
      >
        <ParallaxBg worldX={worldX} />

        <div className="absolute inset-0">
          <div className="absolute bottom-10 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        </div>

        <canvas
          ref={particleCanvasRef}
          className="pointer-events-none absolute inset-0"
        />

        <Player y={playerY} squish={playerSquish} />

        {obstacles
          .filter((item) => item.active)
          .map((item) => (
            <Obstacle
              key={item.id}
              x={item.x}
              y={item.y}
              height={item.height}
              variant={item.type}
            />
          ))}

        <div
          className={
            isCalibrating
              ? "absolute left-1/2 top-1/2 z-20 h-[220px] w-[392px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-600/50 bg-glass p-2"
              : "absolute bottom-6 right-6 z-20 h-[108px] w-[192px] rounded-lg border border-slate-600/50 bg-slate-950/70 p-1"
          }
        >
          <video
            ref={videoRef}
            className="h-full w-full rounded-lg object-cover opacity-90"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={overlayRef}
            width={isCalibrating ? 392 : 192}
            height={isCalibrating ? 220 : 108}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-30"
          />
        </div>

        <Hud
          fps={fps}
          keypoints={keypoints}
          preferKeyboard={preferKeyboard}
          onToggleControls={() => setPreferKeyboard(!preferKeyboard)}
          gestureIndicator={gestureIndicator}
          jumpReady={jumpReady}
          videoRef={videoRef}
          overlayRef={overlayRef}
        />

        <PauseModal
          isOpen={isPaused}
          reason={pauseReason}
          onResume={handleResume}
          onRecalibrate={handleRecalibrate}
          onQuit={handleQuit}
        />

        <GameOverModal
          isOpen={isGameOver}
          distance={distance}
          highScore={highScore}
          onReplay={handleReplay}
          onRecalibrate={handleRecalibrate}
        />

        {isCalibrating && (
          <Calibration
            hasPose={hasPose}
            hasWrist={hasWrist}
            isModelReady={isModelReady}
            wristNormalizedY={wristFilteredNormalizedY || wristNormalizedY}
            onComplete={handleCalibrationComplete}
            onSkip={handleSkipCalibration}
            onError={(message) => setToast(message)}
          />
        )}

        {hitFlash && (
          <motion.div
            className="absolute inset-0 z-30 bg-red-500/30"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slideUp}
          />
        )}

        {toast && (
          <motion.div
            className="absolute bottom-6 left-1/2 z-50 w-[min(360px,90vw)] -translate-x-1/2 rounded-xl bg-glass px-4 py-3 text-sm text-slate-200"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slideUp}
          >
            {toast}
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
