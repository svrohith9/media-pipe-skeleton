"use client";

import DiagnosticHUD from "../components/DiagnosticHUD";
import ErrorBoundary from "../components/ErrorBoundary";
import GameStage from "../components/GameStage";

export default function Home() {
  return (
    <ErrorBoundary>
      <GameStage />
      <DiagnosticHUD />
    </ErrorBoundary>
  );
}
