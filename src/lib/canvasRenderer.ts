// Pure canvas rendering for DrawOps. Everything here operates on the fixed
// 800x600 logical canvas, so every client rasterizes identically — strokes
// AND flood fills produce the same pixels everywhere.
import { CANVAS_WIDTH, CANVAS_HEIGHT, DrawOp, StrokeOp } from './protocol';

export const BACKGROUND_COLOR = '#FFFFFF';

// Anti-aliasing puts in-between pixels along edges; a tolerance lets the fill
// swallow those instead of leaving halos.
const FILL_TOLERANCE = 32;

export function clearToBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function applyStrokeStyle(ctx: CanvasRenderingContext2D, op: StrokeOp) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (op.tool === 'eraser') {
    ctx.strokeStyle = BACKGROUND_COLOR;
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.lineWidth = op.size * 2;
  } else {
    ctx.strokeStyle = op.color;
    ctx.fillStyle = op.color;
    ctx.lineWidth = op.size;
  }
}

// Draws a polyline segment through the given points. `from` (when provided)
// is the previous point of the same stroke, so batches connect seamlessly.
export function drawStrokeSegment(
  ctx: CanvasRenderingContext2D,
  op: StrokeOp,
  from?: [number, number]
) {
  if (op.points.length === 0) return;
  applyStrokeStyle(ctx, op);

  if (!from && op.points.length === 1) {
    // Single point: draw a dot.
    const [x, y] = op.points[0];
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  const start = from ?? op.points[0];
  ctx.moveTo(start[0], start[1]);
  for (const [x, y] of from ? op.points : op.points.slice(1)) {
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export function renderOp(ctx: CanvasRenderingContext2D, op: DrawOp) {
  if (op.t === 's') {
    drawStrokeSegment(ctx, op);
  } else {
    floodFill(ctx, op.x, op.y, op.color);
  }
}

// Replays a full op history onto a cleared canvas.
export function replayOps(ctx: CanvasRenderingContext2D, ops: DrawOp[]) {
  clearToBackground(ctx);
  for (const op of ops) renderOp(ctx, op);
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.substring(1, 3), 16),
    parseInt(hex.substring(3, 5), 16),
    parseInt(hex.substring(5, 7), 16),
  ];
}

// Scanline stack flood fill with per-channel tolerance, always at the fixed
// logical resolution so its cost is bounded and its result deterministic.
export function floodFill(ctx: CanvasRenderingContext2D, fx: number, fy: number, color: string) {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  if (x0 < 0 || x0 >= CANVAS_WIDTH || y0 < 0 || y0 >= CANVAS_HEIGHT) return;

  const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const data = imageData.data;
  const [fr, fg, fb] = hexToRgb(color);

  const startPos = (y0 * CANVAS_WIDTH + x0) * 4;
  const tr = data[startPos];
  const tg = data[startPos + 1];
  const tb = data[startPos + 2];

  // Clicking on the fill color itself is a no-op.
  if (Math.abs(tr - fr) <= FILL_TOLERANCE && Math.abs(tg - fg) <= FILL_TOLERANCE && Math.abs(tb - fb) <= FILL_TOLERANCE) {
    return;
  }

  const matches = (pos: number) =>
    Math.abs(data[pos] - tr) <= FILL_TOLERANCE &&
    Math.abs(data[pos + 1] - tg) <= FILL_TOLERANCE &&
    Math.abs(data[pos + 2] - tb) <= FILL_TOLERANCE;

  const paint = (pos: number) => {
    data[pos] = fr;
    data[pos + 1] = fg;
    data[pos + 2] = fb;
    data[pos + 3] = 255;
  };

  const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);
  const stack = [x0 + y0 * CANVAS_WIDTH];
  visited[stack[0]] = 1;

  while (stack.length) {
    const idx = stack.pop()!;
    const px = idx % CANVAS_WIDTH;
    const py = (idx - px) / CANVAS_WIDTH;
    paint(idx * 4);

    const neighbors = [
      px > 0 ? idx - 1 : -1,
      px < CANVAS_WIDTH - 1 ? idx + 1 : -1,
      py > 0 ? idx - CANVAS_WIDTH : -1,
      py < CANVAS_HEIGHT - 1 ? idx + CANVAS_WIDTH : -1,
    ];
    for (const n of neighbors) {
      if (n >= 0 && !visited[n] && matches(n * 4)) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
