// All game tuning knobs live here.
module.exports = {
  // Room / players
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  MAX_USERNAME_LEN: 16,

  // Game settings (host-configurable within these bounds)
  DEFAULT_ROUNDS: 3,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 10,
  DEFAULT_DRAW_TIME: 60,
  MIN_DRAW_TIME: 30,
  MAX_DRAW_TIME: 120,

  // Turn flow
  WORD_SELECT_SECONDS: 20,
  TURN_END_DELAY_MS: 3000,
  // How long a disconnected player may reconnect (same username, score kept)
  // before being removed for good.
  RECONNECT_GRACE_MS: 60000,

  // Chat
  MAX_MESSAGES: 100,
  MAX_CHAT_LEN: 200,

  // Canvas — logical coordinate space shared by every client.
  // Must match CANVAS_WIDTH/HEIGHT in src/lib/protocol.ts.
  CANVAS_WIDTH: 1000,
  CANVAS_HEIGHT: 700,
  MIN_BRUSH_SIZE: 1,
  MAX_BRUSH_SIZE: 40,

  // Drawing history limits
  MAX_CANVAS_OPS: 2000,
  MAX_STROKE_POINTS: 2000,
  MAX_POINTS_PER_BATCH: 200,
  MAX_OPS_PER_BATCH: 20,
  DRAW_BATCHES_PER_SECOND: 60,

  // Scoring
  GUESS_BASE_SCORE: 50,
  GUESS_TIME_BONUS: 250,
  DRAWER_MAX_SCORE: 200,
};
