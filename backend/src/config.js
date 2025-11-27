require('dotenv').config();

const config = {
  port: process.env.PORT || 8000,
  wsPath: process.env.WS_PATH || '/ws',
  // Force-enable CORS for every origin (HTTP + WebSocket)
  corsOrigins: ['*'],
  allowAllOrigins: true
};

module.exports = config;
