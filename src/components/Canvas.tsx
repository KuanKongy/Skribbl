import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Brush, Eraser, PaintBucket, Trash2, Undo2 } from 'lucide-react';
import socketService from '@/services/socket';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DrawOp, StrokeOp } from '@/lib/protocol';
import {
  clearToBackground,
  drawStrokeSegment,
  renderOp,
  replayOps,
} from '@/lib/canvasRenderer';

// How often buffered stroke points are flushed to the server. ~25 batches/s
// of a few points each — a few KB/s, versus the old full-PNG-per-mousemove.
const FLUSH_INTERVAL_MS = 40;
// Auto-split strokes before they hit the server's per-stroke point cap.
const STROKE_SPLIT_POINTS = 1900;

export interface CanvasHandle {
  applyOps(ops: DrawOp[]): void;
  resetOps(ops: DrawOp[]): void;
  undoLast(): void;
  reset(): void;
}

interface CanvasProps {
  // True while this client is the drawer during the drawing phase.
  canDraw: boolean;
}

const COLOR_OPTIONS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF8000', '#FFFF00',
  '#80FF00', '#00FF00', '#00FF80', '#00FFFF', '#0080FF',
  '#0000FF', '#8000FF', '#FF00FF', '#FF0080', '#964B00',
  '#808080', '#C0C0C0', '#FFC0CB', '#800000', '#008000',
];

// The offscreen logical-resolution canvas is the authoritative bitmap on every client;
// the visible canvas is just a scaled blit of it. That keeps all clients
// pixel-identical regardless of window size and makes resizing lossless.
const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ canDraw }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const opsRef = useRef<DrawOp[]>([]);
  const currentStrokeRef = useRef<StrokeOp | null>(null);
  const pendingPointsRef = useRef<[number, number][]>([]);
  const opSeqRef = useRef(0);
  const flushTimerRef = useRef<number | null>(null);

  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'fill'>('brush');

  if (!offscreenRef.current) {
    const off = document.createElement('canvas');
    off.width = CANVAS_WIDTH;
    off.height = CANVAS_HEIGHT;
    clearToBackground(off.getContext('2d')!);
    offscreenRef.current = off;
  }

  const getOffCtx = () => offscreenRef.current!.getContext('2d')!;

  const blit = useCallback(() => {
    const display = displayRef.current;
    const off = offscreenRef.current;
    if (!display || !off || display.width === 0) return;
    const ctx = display.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, display.width, display.height);
  }, []);

  // Fit the visible canvas inside its container at the logical aspect ratio,
  // capped at 1:1 with the logical resolution — the canvas never upscales,
  // so it stays crisp and its size is stable across window resizes.
  useEffect(() => {
    const fit = () => {
      const container = containerRef.current;
      const display = displayRef.current;
      if (!container || !display) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw === 0 || ch === 0) return;
      const scale = Math.min(1, cw / CANVAS_WIDTH, ch / CANVAS_HEIGHT);
      const w = Math.max(1, Math.floor(CANVAS_WIDTH * scale));
      const h = Math.max(1, Math.floor(CANVAS_HEIGHT * scale));
      if (display.width !== w || display.height !== h) {
        display.width = w;
        display.height = h;
        display.style.width = `${w}px`;
        display.style.height = `${h}px`;
      }
      blit();
    };
    const observer = new ResizeObserver(fit);
    if (containerRef.current) observer.observe(containerRef.current);
    fit();
    return () => observer.disconnect();
  }, [blit]);

  // ---- Network -> canvas (imperative handle used by useGameSocket) ----

  useImperativeHandle(
    ref,
    () => ({
      applyOps(ops: DrawOp[]) {
        const ctx = getOffCtx();
        for (const op of ops) {
          const last = opsRef.current[opsRef.current.length - 1];
          if (op.t === 's' && last && last.t === 's' && last.id === op.id) {
            // Continuation of the same stroke: connect from its last point.
            const from = last.points[last.points.length - 1];
            drawStrokeSegment(ctx, op, from);
            last.points.push(...op.points);
          } else {
            renderOp(ctx, op);
            opsRef.current.push(op.t === 's' ? { ...op, points: [...op.points] } : { ...op });
          }
        }
        blit();
      },
      resetOps(ops: DrawOp[]) {
        opsRef.current = ops.map((op) => (op.t === 's' ? { ...op, points: [...op.points] } : { ...op }));
        replayOps(getOffCtx(), opsRef.current);
        blit();
      },
      undoLast() {
        currentStrokeRef.current = null;
        pendingPointsRef.current = [];
        opsRef.current.pop();
        replayOps(getOffCtx(), opsRef.current);
        blit();
      },
      reset() {
        currentStrokeRef.current = null;
        pendingPointsRef.current = [];
        opsRef.current = [];
        clearToBackground(getOffCtx());
        blit();
      },
    }),
    [blit]
  );

  // ---- Drawer input -> local render + batched emit ----

  const flushPending = useCallback(() => {
    const stroke = currentStrokeRef.current;
    if (!stroke || pendingPointsRef.current.length === 0) return;
    const points = pendingPointsRef.current;
    pendingPointsRef.current = [];
    socketService.sendDrawOps([
      { t: 's', id: stroke.id, tool: stroke.tool, color: stroke.color, size: stroke.size, points },
    ]);
  }, []);

  const stopFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const endStroke = useCallback(() => {
    if (!currentStrokeRef.current) return;
    flushPending();
    currentStrokeRef.current = null;
    stopFlushTimer();
  }, [flushPending, stopFlushTimer]);

  useEffect(() => stopFlushTimer, [stopFlushTimer]);

  // Drawing rights revoked mid-stroke (turn ended): finish cleanly.
  useEffect(() => {
    if (!canDraw) endStroke();
  }, [canDraw, endStroke]);

  const toLogical = (e: React.PointerEvent): [number, number] => {
    const rect = displayRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    return [
      Math.round(Math.min(CANVAS_WIDTH, Math.max(0, x)) * 10) / 10,
      Math.round(Math.min(CANVAS_HEIGHT, Math.max(0, y)) * 10) / 10,
    ];
  };

  const beginStroke = (pt: [number, number]) => {
    const stroke: StrokeOp = {
      t: 's',
      id: ++opSeqRef.current,
      tool: tool === 'eraser' ? 'eraser' : 'brush',
      color,
      size: brushSize,
      points: [pt],
    };
    currentStrokeRef.current = stroke;
    opsRef.current.push(stroke);
    pendingPointsRef.current = [pt];
    drawStrokeSegment(getOffCtx(), { ...stroke, points: [pt] });
    blit();
    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setInterval(flushPending, FLUSH_INTERVAL_MS);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !e.isPrimary) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toLogical(e);

    if (tool === 'fill') {
      const op: DrawOp = { t: 'f', id: ++opSeqRef.current, color, x: pt[0], y: pt[1] };
      renderOp(getOffCtx(), op);
      opsRef.current.push(op);
      socketService.sendDrawOps([op]);
      blit();
      return;
    }
    beginStroke(pt);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !e.isPrimary) return;
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    const pt = toLogical(e);
    const prev = stroke.points[stroke.points.length - 1];
    if (Math.abs(prev[0] - pt[0]) < 0.5 && Math.abs(prev[1] - pt[1]) < 0.5) return;

    if (stroke.points.length >= STROKE_SPLIT_POINTS) {
      // Stroke is about to hit the server cap — split into a fresh one.
      endStroke();
      beginStroke(pt);
      return;
    }

    stroke.points.push(pt);
    pendingPointsRef.current.push(pt);
    drawStrokeSegment(getOffCtx(), { ...stroke, points: [pt] }, prev);
    blit();
  };

  const handlePointerUp = () => endStroke();

  const handleUndo = () => {
    // Server pops its history and broadcasts canvas-undo to everyone,
    // including us — the shared handle applies it.
    socketService.undo();
  };

  const handleClear = () => {
    socketService.clearCanvas();
  };

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {/* The toolbar is always rendered (layout stays stable across turns);
          it is merely disabled for everyone but the active drawer. */}
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 shadow-sm transition-opacity dark:bg-gray-800 ${
          canDraw ? '' : 'pointer-events-none opacity-50'
        }`}
        aria-disabled={!canDraw}
      >
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={tool === 'brush' ? 'default' : 'outline'}
            onClick={() => setTool('brush')}
            title="Brush"
            disabled={!canDraw}
          >
            <Brush className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:ml-1">Brush</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            title="Eraser"
            disabled={!canDraw}
          >
            <Eraser className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:ml-1">Eraser</span>
          </Button>
          <Button
            size="sm"
            variant={tool === 'fill' ? 'default' : 'outline'}
            onClick={() => setTool('fill')}
            title="Fill"
            disabled={!canDraw}
          >
            <PaintBucket className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:ml-1">Fill</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleUndo} title="Undo" disabled={!canDraw}>
            <Undo2 className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:ml-1">Undo</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleClear} title="Clear canvas" disabled={!canDraw}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only lg:not-sr-only lg:ml-1">Clear</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              className={`h-6 w-6 rounded-full border-2 transition-transform ${
                color === c
                  ? 'scale-110 border-gray-800 dark:border-white'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              title={c}
              disabled={!canDraw}
            />
          ))}
          <input
            type="range"
            min="1"
            max="30"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="ml-2 w-20"
            title="Brush size"
            disabled={!canDraw}
          />
        </div>
      </div>

      {/* Transparent container: only the white canvas itself is drawable, so
          there is never a white margin that LOOKS drawable but isn't. */}
      <div ref={containerRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        <canvas
          ref={displayRef}
          className={`touch-none rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 ${
            canDraw ? (tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
