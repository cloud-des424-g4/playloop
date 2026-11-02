const read = (name, fallback) => process.env[name] || fallback;

export const env = Object.freeze({
  nodeEnv: read('NODE_ENV', 'development'),
  isProduction: read('NODE_ENV') === 'production',
  logLevel: read('LOG_LEVEL', 'info'),
  jwtSecret: read('JWT_SECRET'),
  jwtExpiresIn: read('JWT_EXPIRES_IN', '7d'),
  clientOrigins: read('CLIENT_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),
});

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'INTERNAL_SERVICE_SECRET'];

export function assertEnv(extraNames = []) {
  const missing = [...REQUIRED, ...extraNames].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}
