const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const registerHandlers = require('./src/handlers');

// Browser origins allowed to connect. Override with CORS_ORIGIN (comma-
// separated). CORS is enforced by browsers only, so non-browser clients
// (tests, the bots script) are never affected by this list.
const DEFAULT_ORIGINS = [
  'https://namkhanhle.dev', // production frontend (GitHub Pages custom domain)
  'https://kuankongy.github.io', // pre-custom-domain Pages origin (redirects)
  'http://localhost:8080', // vite dev server
];
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : DEFAULT_ORIGINS;

const app = express();
app.use(cors({ origin: allowedOrigins }));

app.get('/health', (_req, res) => {
  res.send('Server is running');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
});

registerHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
