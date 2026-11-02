import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.logLevel,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
});
