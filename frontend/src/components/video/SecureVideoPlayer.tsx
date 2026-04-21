"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Shield, AlertTriangle } from "lucide-react";

interface SecureVideoPlayerProps {
  youtubeId: string;
  embedUrl: string;
  watermarkText: string;
  token: string;
  lessonId: string;
  sessionId: string;
  onProgress?: (seconds: number) => void;
}

export function SecureVideoPlayer({
  youtubeId,
  embedUrl,
  watermarkText,
  token,
  lessonId,
  sessionId,
  onProgress,
}: SecureVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [watermarkPos, setWatermarkPos] = useState({ top: "20%", left: "60%" });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionRef = useRef(0);

  // Watermark position changes every 30s to prevent screenshot patterns
  useEffect(() => {
    const moveWatermark = () => {
      setWatermarkPos({
        top: `${15 + Math.random() * 60}%`,
        left: `${10 + Math.random() * 70}%`,
      });
    };

    const interval = setInterval(moveWatermark, 30000);
    return () => clearInterval(interval);
  }, []);

  // Disable right-click on video container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handler = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    container.addEventListener("contextmenu", handler);
    return () => container.removeEventListener("contextmenu", handler);
  }, []);

  // Heartbeat — send every 30s during playback
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
        const storedToken = localStorage.getItem("hatekolom-auth");
        let accessToken = "";
        if (storedToken) {
          const parsed = JSON.parse(storedToken);
          accessToken = parsed?.state?.accessToken || "";
        }

        await fetch(`${apiUrl}/video/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            lesson_id: lessonId,
            session_id: sessionId,
            position_seconds: positionRef.current,
            token,
          }),
        });
      } catch {
        // Silent fail — heartbeat is best-effort
      }
    };

    heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [lessonId, sessionId, token]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden bg-black group"
      style={{ aspectRatio: "16/9" }}
    >
      {/* YouTube iframe */}
      <iframe
        src={`${embedUrl}&origin=${typeof window !== "undefined" ? window.location.origin : ""}`}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />

      {/* Dynamic watermark overlay — moves every 30s */}
      <div
        className="absolute z-20 pointer-events-none select-none"
        style={{
          top: watermarkPos.top,
          left: watermarkPos.left,
          transform: "translate(-50%, -50%)",
        }}
      >
        <span
          className="text-white/15 text-sm font-mono tracking-wider"
          style={{
            textShadow: "0 0 2px rgba(255,255,255,0.1)",
            transform: "rotate(-15deg)",
            display: "inline-block",
          }}
        >
          {watermarkText}
        </span>
      </div>

      {/* Bottom-right shield — blocks "Watch on YouTube" link */}
      <div
        className="absolute bottom-0 right-0 w-36 h-12 z-10 cursor-default"
        onClick={(e) => e.preventDefault()}
      />

      {/* Security indicator */}
      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 bg-black/60 text-white/70 text-xs px-2.5 py-1 rounded-full">
          <Shield className="w-3 h-3" />
          <span>Protected</span>
        </div>
      </div>
    </div>
  );
}
