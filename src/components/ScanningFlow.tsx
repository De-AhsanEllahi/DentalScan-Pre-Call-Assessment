"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  StabilityLevel,
  STABILITY_CONFIG,
  VIEWS,
  TOTAL_STEPS,
  MOTION_THRESHOLD_UNSTABLE,
  MOTION_THRESHOLD_OKAY,
} from "@/constants/scanning";


export default function ScanningFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const motionRef = useRef({ magnitude: 9.8 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stability, setStability] = useState<StabilityLevel>(StabilityLevel.stable);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera access was denied. Please allow camera access in your browser settings."
            : "Could not access camera. Ensure no other app is using it.";
        setCamError(message);
        console.error("Camera error:", err);
      }
    }

    startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    let lastLevel: StabilityLevel = StabilityLevel.stable;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      motionRef.current.magnitude = Math.sqrt(
        (acc.x ?? 0) ** 2 +
        (acc.y ?? 0) ** 2 +
        (acc.z ?? 0) ** 2
      );
    };
    intervalRef.current = setInterval(() => {
      const mag = motionRef.current.magnitude;
      const newLevel: StabilityLevel =
        mag > MOTION_THRESHOLD_UNSTABLE ? StabilityLevel.unstable :
          mag > MOTION_THRESHOLD_OKAY ? StabilityLevel.okay :
            StabilityLevel.stable;

      if (newLevel !== lastLevel) {
        lastLevel = newLevel;
        setStability(newLevel);
      }
    }, 200);

    window.addEventListener("devicemotion", handleMotion);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !camReady) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImages((prev) => [...prev, dataUrl]);
      setCurrentStep((prev) => prev + 1);
    }
  }, [camReady]);

  useEffect(() => {
    if (currentStep === TOTAL_STEPS) {
      fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: `scan_${Date.now()}`, status: "completed" }),
      }).catch((err) => console.error("Notify API error:", err));
    }
  }, [currentStep]);

  const config = STABILITY_CONFIG[stability];
  const isComplete = currentStep >= TOTAL_STEPS;
  const canCapture = camReady && config.canCapture && !isComplete;

  return (
    <div className="flex flex-col items-center bg-black min-h-screen text-white">

      {/* Header */}
      <div className="p-4 w-full bg-zinc-900 border-b border-zinc-800 flex justify-between items-center">
        <h1 className="font-bold text-blue-400">DentalScan AI</h1>
        <span className="text-xs text-zinc-500">
          Step {Math.min(currentStep + 1, TOTAL_STEPS)}/{TOTAL_STEPS}
        </span>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full max-w-md aspect-[3/4] bg-zinc-950 overflow-hidden flex items-center justify-center">

        {/* Camera error state */}
        {camError && (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <AlertCircle size={40} className="text-red-400" />
            <p className="text-sm text-red-300 leading-relaxed">{camError}</p>
          </div>
        )}

        {!camError && !isComplete && (
          <>
            {/* Camera Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* ── MOUTH GUIDE OVERLAY ── */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">

              {/* Dark mask with circle cutout via box-shadow */}
              <div
                className={`
                  rounded-full border-4 transition-all duration-500
                  ${config.borderColor}
                  w-[72%]
                `}
                style={{
                  aspectRatio: "1 / 1",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                }}
              />

              {/* Stability label */}
              <p className={`
                mt-5 text-xs font-semibold tracking-widest uppercase
                transition-colors duration-500 ${config.labelColor}
              `}>
                {config.label}
              </p>
            </div>

            {/* Step instruction at bottom */}
            <div className="absolute bottom-10 left-0 right-0 px-6 text-center">
              <p className="text-sm font-medium text-white drop-shadow-lg">
                {VIEWS[currentStep].instruction}
              </p>
            </div>
          </>
        )}

        {!camError && isComplete && (
          <div className="text-center p-10 flex flex-col items-center">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold">Scan Complete!</h2>
            <p className="text-zinc-400 mt-2 mb-6">Your images are ready for review.</p>
            <Link
              href="/results"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm
                         text-white transition-all duration-200 active:scale-95"
              style={{ backgroundColor: "#61a5fa" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#3b8ef8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#61a5fa")}
            >
              View Results <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* Capture Button */}
      <div className="p-10 w-full flex justify-center">
        {!isComplete && !camError && (
          <button
            onClick={handleCapture}
            disabled={!canCapture}
            title={
              !camReady ? "Waiting for camera..." :
                !config.canCapture ? "Hold your phone steady" :
                  "Capture"
            }
            className={`
              w-20 h-20 rounded-full border-4 flex items-center justify-center
              transition-all duration-300 active:scale-90
              ${canCapture
                ? "border-white cursor-pointer"
                : "border-zinc-600 cursor-not-allowed opacity-60"
              }
            `}
          >
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-colors duration-300
              ${canCapture ? "bg-white" : "bg-zinc-700"}
            `}>
              <Camera className={canCapture ? "text-black" : "text-zinc-500"} />
            </div>
          </button>
        )}
      </div>

      {/* Thumbnails strip */}
      <div className="flex gap-2 p-4 overflow-x-auto w-full justify-center">
        {VIEWS.map((v, i) => (
          <div
            key={v.label}  // stable key — not index
            className={`
              w-16 h-20 rounded border-2 shrink-0 overflow-hidden
              ${i === currentStep
                ? "border-blue-500 bg-blue-500/10"
                : i < currentStep
                  ? "border-green-600"
                  : "border-zinc-800"
              }
            `}
          >
            {capturedImages[i] ? (
              <img
                src={capturedImages[i]}
                className="w-full h-full object-cover"
                alt={v.label}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <span className="text-[10px] text-zinc-600">{i + 1}</span>
                <span className="text-[8px] text-zinc-700 text-center px-1 leading-tight">
                  {v.label}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}