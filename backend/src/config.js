require('dotenv').config();

const normalizeOrigin = (origin) => {
  if (!origin || origin === '*') {
    return origin;
  }
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
};

const parseOrigins = (value) => (
  value
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean)
);

const allowAllOrigins = process.env.CORS_ALLOW_ALL !== 'false';

let corsOrigins = ['*'];
if (!allowAllOrigins) {
  const originEnv = process.env.CORS_ORIGIN;
  corsOrigins = originEnv ? parseOrigins(originEnv) : [];
}

const config = {
  port: process.env.PORT || 8000,
  wsPath: process.env.WS_PATH || '/ws',
  corsOrigins,
  allowAllOrigins
};

module.exports = config;
