# Skribbl

A real-time multiplayer draw-and-guess game (a [skribbl.io](https://skribbl.io) clone). One player draws a secret word while everyone else races to guess it in chat. Built with React + Vite on the front, Express + Socket.IO on the back.

## Features

- **Rooms** with 6-character codes, 2–10 players, host controls
- **Configurable games** — 1–10 rounds, 30–120s drawing time (set by the host at room creation)
- **Vector-based drawing sync** — strokes are streamed as small batched point operations (a few KB/s), not images; late joiners get the in-progress drawing replayed
- **Drawing tools** — brush, eraser, flood fill, undo, clear, 20 colors, brush sizes; mouse and touch
- **Word choice** — the drawer picks 1 of 3 words (auto-picked after 20s)
- **Hints** — letters are progressively revealed to guessers as time runs down
- **Scoring** — guessers earn more for faster guesses; the drawer earns points per correct guesser
- **Mid-game join** — players can join a running game as guessers and rotate into drawing
- **Close-guess hints**, word-leak protection (the drawer can't type the word into chat)
- **Disconnect grace** — a player whose tab closes or connection drops keeps their seat and score for 60s and can rejoin with the same username; if too few players remain connected, the game pauses at the turn boundary instead of ending
- Host migration on disconnect, game-over podium, dark mode, responsive layout

## Architecture

```
┌─────────────────┐          socket.io           ┌──────────────────────┐
│  React client   │ ───────  websocket  ───────► │  Express + socket.io │
│  (Vite, :8080)  │ ◄──────  events     ──────── │  server (:3001)      │
└─────────────────┘                              └──────────────────────┘
        │                                                   │
   renders state,                                    owns ALL game state:
   sends inputs                                      rooms, turns, timers,
                                                     scores, canvas history
```

The server is **authoritative**: clients send intents (`start-game`, `word-selected`, `draw-ops`, `chat-message`) and render what the server broadcasts. All validation, authorization (host-only / drawer-only), timers, and scoring run server-side.

### Server layout (`server/`)

| File | Responsibility |
|---|---|
| `index.js` | Bootstrap: Express app, `/health`, socket.io server |
| `src/config.js` | Every tuning knob (player caps, timers, scoring, canvas limits) |
| `src/GameRoom.js` | The core: per-room state machine, timers, scoring, chat, canvas history |
| `src/roomManager.js` | Room registry — create/get/destroy (destroy disposes all timers) |
| `src/handlers.js` | Socket event wiring: payload validation + auth guards, then delegate |
| `src/words.js` | Word list (~230 words) and word helpers (mask, reveal, Levenshtein) |
| `src/validate.js` | Payload sanitizers (usernames, settings, draw ops) |
| `test/gameRoom.test.js` | Unit tests for the turn engine (`npm test`) |
| `test/bots.js` | Headless bot swarm for 10-player load testing (`npm run bots`) |

### Game flow

```
lobby ──start-game──► choosing ──word picked──► drawing ──time up /──► turn-end
  ▲                   (drawer picks               (guess,   all guessed     │
  │                    1 of 3, 20s)                draw)                    │ 3s
  │                        ▲                                                ▼
  └── play again ── game-over ◄── all rounds done ──── next drawer ◄── advance
```

Every phase transition is gated on the current phase, so duplicate events or stale timers can never double-advance a turn. Each turn runs on a single server-side clock (a per-second tick that counts down word selection, then drawing time), plus a turn-end delay timer; both are centrally cleared on every transition and when the room is destroyed.

**Turn rotation** uses a per-round set of "already drew" player ids rather than an index, so joins and leaves mid-round never skip or repeat a drawer. If the drawer disconnects, the turn ends immediately (`drawer-left`) and play continues.

**Disconnects vs. leaves**: an explicit *Leave Room* removes the player at once, but a dropped socket (closed tab, network blip) only marks them disconnected for `RECONNECT_GRACE_MS` (60s). Rejoining with the same username within the window restores their seat, score, and turn state. While too few players are *connected*, the game pauses at the next turn boundary (`waitingForPlayers`) rather than ending; it ends only when the roster itself (including reconnectable players) drops below 2.

**Scoring** — guesser: `50 + 250 × timeLeft/drawTime`; drawer: `200 × correctGuessers/(players−1)` awarded at turn end.

### How drawing sync works

This is the interesting part. Instead of shipping canvas images, every client keeps an **offscreen 1000×700 canvas** as the authoritative bitmap and scales it to its display size. The drawer streams *operations* in that fixed logical space:

```ts
type StrokeOp = { t:'s', id, tool:'brush'|'eraser', color, size, points: [x,y][] }
type FillOp   = { t:'f', id, color, x, y }
```

- While drawing, points are buffered and flushed every **40ms** (~25 small messages/s, roughly 3 KB/s — versus tens of KB *per mouse event* if you send the canvas as an image).
- Batches of the same stroke share an `id`; the server and every receiver merge them into one stroke, drawing from the stroke's last point so lines stay continuous.
- The server keeps the op history per room (capped), which enables **replay for late joiners**, **undo** (pop the last op, everyone replays), and **clear**.
- Flood fill is sent as a click point and executed locally by every client with the same tolerance on identical 1000×700 bitmaps, so results match everywhere.
- The server validates every op (drawer-only, color format, coordinate bounds, size, rate limits) before relaying.

## Socket protocol

Client → server (room membership is tracked server-side; only `join-room` carries a room id):

| Event | Guard | Payload |
|---|---|---|
| `create-room` | valid username/settings | `{ username, settings: { rounds, drawTime } }` |
| `join-room` | room exists, <10 players, unique name | `{ roomId, username }` |
| `leave-room` | member | — |
| `start-game` | **host**, in lobby/game-over, ≥2 players | — |
| `word-selected` | **drawer**, choosing phase, word ∈ options | `{ word }` |
| `draw-ops` | **drawer**, drawing phase | `{ ops: DrawOp[] }` |
| `undo`, `clear-canvas` | **drawer**, drawing phase | — |
| `chat-message` | member | `{ message }` |
| `sync` | member | — (server re-sends state/canvas/word options) |

Server → client:

| Event | To | Payload |
|---|---|---|
| `room-created` | creator | `{ roomId, playerId }` |
| `room-joined` | joiner | `{ roomId, playerId, state }` |
| `room-state` | room | full `RoomState` snapshot (players, phase, round, settings, drawer, mask…) |
| `player-joined` / `player-left` | room | `{ player }` / `{ playerId, username, newHostId? }` |
| `turn-started` | room | `{ round, totalRounds, drawerId, drawerName }` |
| `select-word` | drawer | `{ words[3], timeoutSec }` |
| `drawing-phase` | room | `{ drawerId, wordLength, drawTime, mask }` |
| `your-word` | drawer | `{ word }` |
| `draw-ops` | room − drawer | `{ ops }` |
| `canvas-state` | one socket | `{ ops }` (full replay) |
| `canvas-undo` / `canvas-cleared` | room | — |
| `time-update` | room | `{ timeLeft }` |
| `word-hint` | room − drawer | `{ mask }` |
| `player-guessed` | room | `{ playerId, username, gained, totalScore }` |
| `correct-guess` | guesser | `{ word }` |
| `turn-ended` | room | `{ word, reason: 'time'\|'all-guessed'\|'drawer-left'\|'no-guessers', scores }` |
| `game-over` | room | `{ players }` (sorted) |
| `new-message` | room | `{ id, playerId, username, message, type }` |
| `error` | sender | `{ code, message }` |

Client-side types for all of these live in `src/lib/protocol.ts`.

### Client layout (`src/`)

| Path | Responsibility |
|---|---|
| `services/socket.ts` | Socket singleton: connection, listener registry, typed emit helpers |
| `lib/protocol.ts` | Shared payload/`DrawOp` types + logical canvas dimensions |
| `lib/canvasRenderer.ts` | Pure rendering: stroke segments, replay, tolerant flood fill |
| `state/gameReducer.ts` | All game state in one reducer (no stale-closure bugs) |
| `hooks/useGameSocket.ts` | Registers every listener once; drawing events go straight to the canvas |
| `components/Canvas.tsx` | Offscreen 1000×700 canvas, pointer input, stroke batching, tools |
| `components/GameRoom.tsx` | Game screen layout + phase overlays |
| `components/LobbyRoom.tsx` | Entry form (join/create with settings) + waiting room |
| `components/GameOver.tsx` | Final standings + play again |
| `components/ConnectionStatus.tsx` | Reconnecting/offline banner |

## Getting started

Prerequisites: Node.js ≥ 18.4.

```sh
# 1. Start the server (port 3001)
cd server
npm install
npm run dev

# 2. Start the client (port 8080) — in another terminal, from the repo root
npm install
npm run dev
```

Open http://localhost:8080 in two or more tabs, create a room in one, join with the code in the others.

The client reads the server URL from `VITE_SOCKET_URL` (defaults to `http://localhost:3001`). To change it, copy `.env.example` to `.env` **at the repo root** (next to `package.json`) and restart the dev server — Vite only reads env files at startup.

Format: scheme + host + optional port, **no path** (the URL is passed to `io()`, which treats a path as a socket.io namespace). A trailing slash is tolerated but unnecessary.

```sh
VITE_SOCKET_URL=http://localhost:3001            # local (the default)
VITE_SOCKET_URL=https://your-server.example.com  # deployed — must be https when the
                                                 # client is served over https
```

## Configuration

- **Lobby settings** (per room): rounds and drawing time, chosen by the host in the Create Room tab.
- **Server knobs**: everything else lives in `server/src/config.js` — player caps, word-select timeout, hint reveal pacing, scoring constants, canvas/history limits, chat caps.
- **Words**: edit the list in `server/src/words.js`.

## Testing

```sh
# Turn-engine unit tests (fake sockets, mocked timers)
cd server && npm test

# 10-player load test: start the server, create a room in the browser,
# then fill it with 9 drawing/guessing bots:
cd server && npm run bots -- <ROOMCODE>
```

Manual multi-client testing: open several tabs on localhost — each tab is an independent player.

## Deployment

- **Server**: any Node host (a `Procfile` is included for Heroku-style platforms). Configure:
  - `PORT` — listen port (default 3001)
  - `CORS_ORIGIN` — comma-separated list of allowed browser origins. Defaults (in `server/index.js`) to the production frontend `https://namkhanhle.dev`, the `github.io` origin, and `http://localhost:8080` for dev. Origins are scheme + host only — no path, so no `/Skribbl`.
- **Client** — two options, both publish to GitHub Pages (base path `/Skribbl/`):
  - **CI (recommended)**: `.github/workflows/deploy.yml` runs on every push to `main` — it runs the server tests, builds the client with `VITE_SOCKET_URL` taken from the repo's Actions secret of the same name, and deploys to Pages. One-time setup: add the `VITE_SOCKET_URL` secret (Settings → Secrets and variables → Actions) and set Settings → Pages → Source to **GitHub Actions**.
  - **Manual**: `VITE_SOCKET_URL=https://your-server.example.com npm run deploy` pushes a build to the `gh-pages` branch (requires Pages Source set to that branch).

  The server's default CORS allowlist (see below) already covers the production frontend origins, so no extra step is needed after deploying the client.

Note: rooms live in server memory — a restart clears them, and multiple server instances don't share rooms.
