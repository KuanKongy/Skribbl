// Payload validation and sanitization for client-supplied data.
const config = require('./config');

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function sanitizeUsername(v) {
  if (!isNonEmptyString(v)) return null;
  const name = v.trim().slice(0, config.MAX_USERNAME_LEN);
  return name.length > 0 ? name : null;
}

function sanitizeRoomCode(v) {
  if (!isNonEmptyString(v)) return null;
  return v.trim().toUpperCase().slice(0, 8);
}

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    rounds: clampInt(s.rounds, config.MIN_ROUNDS, config.MAX_ROUNDS, config.DEFAULT_ROUNDS),
    drawTime: clampInt(s.drawTime, config.MIN_DRAW_TIME, config.MAX_DRAW_TIME, config.DEFAULT_DRAW_TIME),
  };
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function clampCoord(v, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;
}

// Returns a sanitized DrawOp or null if the op is malformed.
function sanitizeDrawOp(op) {
  if (!op || typeof op !== 'object') return null;

  if (op.t === 's') {
    if (op.tool !== 'brush' && op.tool !== 'eraser') return null;
    if (!HEX_COLOR_RE.test(op.color)) return null;
    if (!Number.isFinite(op.id)) return null;
    if (!Array.isArray(op.points) || op.points.length === 0) return null;
    const size = clampInt(op.size, config.MIN_BRUSH_SIZE, config.MAX_BRUSH_SIZE, config.MIN_BRUSH_SIZE);
    const points = [];
    for (const p of op.points.slice(0, config.MAX_POINTS_PER_BATCH)) {
      if (!Array.isArray(p) || p.length !== 2) return null;
      const x = clampCoord(p[0], config.CANVAS_WIDTH);
      const y = clampCoord(p[1], config.CANVAS_HEIGHT);
      if (x === null || y === null) return null;
      points.push([x, y]);
    }
    return { t: 's', id: Math.round(op.id), tool: op.tool, color: op.color, size, points };
  }

  if (op.t === 'f') {
    if (!HEX_COLOR_RE.test(op.color)) return null;
    if (!Number.isFinite(op.id)) return null;
    const x = clampCoord(op.x, config.CANVAS_WIDTH);
    const y = clampCoord(op.y, config.CANVAS_HEIGHT);
    if (x === null || y === null) return null;
    return { t: 'f', id: Math.round(op.id), color: op.color, x, y };
  }

  return null;
}

function sanitizeDrawOps(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, config.MAX_OPS_PER_BATCH).map(sanitizeDrawOp).filter(Boolean);
}

module.exports = {
  isNonEmptyString,
  sanitizeUsername,
  sanitizeRoomCode,
  sanitizeSettings,
  sanitizeDrawOps,
  clampInt,
};
