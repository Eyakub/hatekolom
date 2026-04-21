"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Paintbrush, Eraser, Undo2, Redo2, Trash2, Save, Pen, Highlighter, SprayCan } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

type BrushType = "pen" | "marker" | "crayon" | "spray" | "highlighter";

interface Stroke {
  tool: "brush" | "eraser";
  brushType: BrushType;
  color: string;
  size: number;
  points: Point[];
}

const BRUSH_TYPES: { id: BrushType; label: string; icon: "pen" | "marker" | "crayon" | "spray" | "highlighter" }[] = [
  { id: "pen", label: "Pen", icon: "pen" },
  { id: "marker", label: "Marker", icon: "marker" },
  { id: "crayon", label: "Crayon", icon: "crayon" },
  { id: "spray", label: "Spray", icon: "spray" },
  { id: "highlighter", label: "Highlighter", icon: "highlighter" },
];

interface DrawingCanvasProps {
  onSave: (imageBlob: Blob) => void;
  challengePrompt?: string;
  readOnly?: boolean;
  initialImage?: string;
  width?: number;
  height?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#A855F7", // purple
  "#EC4899", // pink
  "#92400E", // brown
  "#111827", // black
  "#6B7280", // gray
  "#FFFFFF", // white
  "#FF6B35", // bright orange-red
  "#00D4FF", // bright cyan
  "#ADFF2F", // bright lime
  "#FF1493", // deep pink
];

const BRUSH_SIZES = [
  { label: "S", value: 3 },
  { label: "M", value: 6 },
  { label: "L", value: 12 },
  { label: "XL", value: 20 },
];

// ─── Helper: seeded random for deterministic replay ─────────────────────────

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Helper: draw a single stroke on a canvas context ───────────────────────

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;

  ctx.save();

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.globalCompositeOperation = "source-over";
  const bt = stroke.brushType || "pen";

  if (bt === "pen") {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  } else if (bt === "marker") {
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.lineWidth = stroke.size * 2.5;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  } else if (bt === "crayon") {
    // Textured crayon: multiple jittered lines for rough look
    const rng = seededRandom(Math.round(stroke.points[0].x * 1000 + stroke.points[0].y));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = stroke.color;
    const passes = 3;
    for (let pass = 0; pass < passes; pass++) {
      ctx.lineWidth = stroke.size * (0.6 + pass * 0.3);
      ctx.beginPath();
      ctx.moveTo(
        stroke.points[0].x + (rng() - 0.5) * stroke.size * 0.8,
        stroke.points[0].y + (rng() - 0.5) * stroke.size * 0.8
      );
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(
          stroke.points[i].x + (rng() - 0.5) * stroke.size * 0.8,
          stroke.points[i].y + (rng() - 0.5) * stroke.size * 0.8
        );
      }
      ctx.stroke();
    }
  } else if (bt === "spray") {
    // Spray paint: scatter dots around each point
    const rng = seededRandom(Math.round(stroke.points[0].x * 1000 + stroke.points[0].y));
    ctx.fillStyle = stroke.color;
    const radius = stroke.size * 2.5;
    const density = Math.max(8, Math.floor(stroke.size * 3));
    for (const pt of stroke.points) {
      for (let d = 0; d < density; d++) {
        const angle = rng() * Math.PI * 2;
        const dist = rng() * radius;
        const dotSize = 0.5 + rng() * 1.5;
        ctx.globalAlpha = 0.3 + rng() * 0.5;
        ctx.beginPath();
        ctx.arc(
          pt.x + Math.cos(angle) * dist,
          pt.y + Math.sin(angle) * dist,
          dotSize,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  } else if (bt === "highlighter") {
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.lineWidth = stroke.size * 4;
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = stroke.color;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Helper: redraw all strokes on a canvas context ──────────────────────────

function replayStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DrawingCanvas({
  onSave,
  challengePrompt,
  readOnly = false,
  initialImage,
  width = 1200,
  height = 750,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushType, setBrushType] = useState<BrushType>("pen");
  const [color, setColor] = useState<string>("#111827");
  const [brushSize, setBrushSize] = useState<number>(6);

  // Stroke history for undo/redo
  const [history, setHistory] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);

  // Current stroke being drawn (mutable ref to avoid re-renders on every point)
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  // Clear confirmation modal
  const [showClearModal, setShowClearModal] = useState(false);

  // ── Load initial image ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!initialImage || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = initialImage;
  }, [initialImage, width, height]);

  // ── Map screen → canvas coordinates ────────────────────────────────────────
  const getCanvasPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    []
  );

  // ── Draw a live segment on the canvas (for real-time feedback) ──────────────
  const drawLiveSegment = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      from: Point,
      to: Point,
      stroke: Stroke
    ) => {
      ctx.save();
      const bt = stroke.brushType || "pen";

      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = stroke.size;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else if (bt === "pen") {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = stroke.size;
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else if (bt === "marker") {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "square";
        ctx.lineJoin = "miter";
        ctx.lineWidth = stroke.size * 2.5;
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else if (bt === "crayon") {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = stroke.color;
        for (let pass = 0; pass < 3; pass++) {
          ctx.lineWidth = stroke.size * (0.6 + pass * 0.3);
          const jitter = stroke.size * 0.8;
          ctx.beginPath();
          ctx.moveTo(from.x + (Math.random() - 0.5) * jitter, from.y + (Math.random() - 0.5) * jitter);
          ctx.lineTo(to.x + (Math.random() - 0.5) * jitter, to.y + (Math.random() - 0.5) * jitter);
          ctx.stroke();
        }
      } else if (bt === "spray") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = stroke.color;
        const radius = stroke.size * 2.5;
        const density = Math.max(8, Math.floor(stroke.size * 3));
        for (let d = 0; d < density; d++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * radius;
          ctx.globalAlpha = 0.3 + Math.random() * 0.5;
          ctx.beginPath();
          ctx.arc(
            to.x + Math.cos(angle) * dist,
            to.y + Math.sin(angle) * dist,
            0.5 + Math.random() * 1.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      } else if (bt === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.lineWidth = stroke.size * 4;
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = stroke.color;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      ctx.restore();
    },
    []
  );

  // ── Pointer handlers ────────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (readOnly) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      const point = getCanvasPoint(e);
      const newStroke: Stroke = {
        tool,
        brushType,
        color,
        size: brushSize,
        points: [point],
      };
      currentStrokeRef.current = newStroke;

      // Clear redo stack whenever a new stroke starts
      setUndoneStrokes([]);
    },
    [readOnly, tool, brushType, color, brushSize, getCanvasPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current || !currentStrokeRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      const point = getCanvasPoint(e);
      const stroke = currentStrokeRef.current;
      const prev = stroke.points[stroke.points.length - 1];
      stroke.points.push(point);

      drawLiveSegment(ctx, prev, point, stroke);
    },
    [getCanvasPoint, drawLiveSegment]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;

    const finishedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    // Only record strokes with actual movement
    if (finishedStroke.points.length >= 1) {
      // If it's a single tap with no movement, duplicate the point so redraw works
      if (finishedStroke.points.length === 1) {
        finishedStroke.points.push({ ...finishedStroke.points[0] });
      }
      setHistory((prev) => {
        const newHistory = [...prev, finishedStroke];
        // Full replay for brush types that need deterministic rendering
        const bt = finishedStroke.brushType || "pen";
        if (bt === "crayon" || bt === "spray") {
          const ctx = canvasRef.current?.getContext("2d");
          if (ctx) replayStrokes(ctx, newHistory, width, height);
        }
        return newHistory;
      });
    }
  }, [width, height]);

  // ── Undo ────────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setUndoneStrokes((prev) => [...prev, last]);

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    replayStrokes(ctx, newHistory, width, height);
  }, [history, width, height]);

  // ── Redo ────────────────────────────────────────────────────────────────────
  const handleRedo = useCallback(() => {
    if (undoneStrokes.length === 0) return;
    const stroke = undoneStrokes[undoneStrokes.length - 1];
    const newUndone = undoneStrokes.slice(0, -1);
    setUndoneStrokes(newUndone);

    const newHistory = [...history, stroke];
    setHistory(newHistory);

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    replayStrokes(ctx, newHistory, width, height);
  }, [history, undoneStrokes, width, height]);

  // ── Clear (with modal) ──────────────────────────────────────────────────────
  const handleClearConfirmed = useCallback(() => {
    setShowClearModal(false);
    setHistory([]);
    setUndoneStrokes([]);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  }, [width, height]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onSave(blob);
    }, "image/png");
  }, [onSave]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 w-full select-none">
      {/* Challenge prompt banner */}
      {challengePrompt && (
        <div className="w-full max-w-[1200px] bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2 text-yellow-800 font-semibold text-sm text-center">
          🎨 {challengePrompt}
        </div>
      )}

      {/* Toolbar */}
      {!readOnly && (
        <div className="w-full max-w-[1200px] bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          {/* Brush types */}
          <div className="flex gap-1">
            {BRUSH_TYPES.map((bt) => {
              const isActive = tool === "brush" && brushType === bt.id;
              const icons: Record<string, React.ReactNode> = {
                pen: <Pen size={18} />,
                marker: <Paintbrush size={18} />,
                crayon: <span className="text-sm font-bold leading-none">🖍️</span>,
                spray: <SprayCan size={18} />,
                highlighter: <Highlighter size={18} />,
              };
              return (
                <button
                  key={bt.id}
                  onClick={() => { setTool("brush"); setBrushType(bt.id); }}
                  title={bt.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-blue-500 text-white shadow-md scale-105"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {icons[bt.icon]}
                </button>
              );
            })}
            <button
              onClick={() => setTool("eraser")}
              title="Eraser"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                tool === "eraser"
                  ? "bg-blue-500 text-white shadow-md scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Eraser size={20} />
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-200" />

          {/* Color swatches — 2 rows × 8 */}
          <div className="grid grid-rows-2 grid-flow-col gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => {
                  setColor(c);
                  setTool("brush");
                }}
                className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${
                  color === c && tool === "brush"
                    ? "border-blue-500 scale-110 shadow-md"
                    : "border-gray-300"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-200" />

          {/* Brush size */}
          <div className="flex items-center gap-2">
            {BRUSH_SIZES.map((bs) => (
              <button
                key={bs.value}
                onClick={() => setBrushSize(bs.value)}
                title={`${bs.label} (${bs.value}px)`}
                className={`flex items-center justify-center rounded-full transition-all border-2 ${
                  brushSize === bs.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
                style={{
                  width: Math.max(bs.value * 2 + 12, 28),
                  height: Math.max(bs.value * 2 + 12, 28),
                }}
              >
                <span
                  className="rounded-full bg-gray-800"
                  style={{
                    width: bs.value,
                    height: bs.value,
                    backgroundColor: tool === "brush" ? color : "#6B7280",
                  }}
                />
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-200" />

          {/* Undo / Redo / Clear / Save */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={handleRedo}
              disabled={undoneStrokes.length === 0}
              title="Redo"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Redo2 size={18} />
            </button>
            <button
              onClick={() => setShowClearModal(true)}
              title="Clear canvas"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 transition-all"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleSave}
              title="Save drawing"
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-500 text-white hover:bg-green-600 shadow-sm transition-all"
            >
              <Save size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Canvas wrapper — CSS scales to fit, internal resolution stays fixed */}
      <div className="w-full max-w-[1200px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            touchAction: "none",
            cursor: readOnly
              ? "default"
              : tool === "eraser"
              ? "cell"
              : "crosshair",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {/* ── Clear confirmation modal ── */}
      {showClearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">🗑️</div>
            <h2 className="text-xl font-bold text-gray-800 text-center">
              Clear the canvas?
            </h2>
            <p className="text-gray-500 text-sm text-center">
              This will erase everything you've drawn. You can't undo this
              action.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                Keep Drawing
              </button>
              <button
                onClick={handleClearConfirmed}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-sm transition-all"
              >
                Yes, Clear It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
