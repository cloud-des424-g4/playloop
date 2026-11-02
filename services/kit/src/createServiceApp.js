import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { requestContext } from './context.js';
import { env } from './env.js';
import { errorHandler } from './errorHandler.js';
import { healthRoutes } from './health.js';
import { internalGuard } from './internal.js';
import { logger } from './logger.js';
import { notFound } from './notFound.js';
import { apiDocs, openApiValidator } from './openapi.js';

export function createServiceApp({ routes, internalRoutes, docs = false }) {
  const app = express();

  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id'] ?? randomUUID(),
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use(requestContext);
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());

  if (docs && !env.isProduction) app.use('/api/docs', apiDocs());
  if (internalRoutes) app.use('/internal', internalGuard, internalRoutes);

  app.use(openApiValidator({ validateResponses: !env.isProduction }));
  app.use('/api/health', healthRoutes);
  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
