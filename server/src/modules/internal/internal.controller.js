import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { setBuildStatus } from '../builds/build.service.js';
import { awardReviewerOfTheMonth } from '../reputation/reputation.service.js';

function requireSignature(req, _res, next) {
  const provided = req.get('x-playloop-signature') ?? '';
  const expected = createHmac('sha256', env.internalWebhookSecret || '')
    .update(req.rawBody ?? '')
    .digest('hex');
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (!env.internalWebhookSecret || left.length !== right.length || !timingSafeEqual(left, right)) {
    throw ApiError.unauthorized('Invalid signature');
  }
  next();
}

export async function buildStatus(req, res) {
  await setBuildStatus(req.params.buildId, req.body);
  res.status(204).end();
}

export async function monthlyBadges(_req, res) {
  await awardReviewerOfTheMonth();
  res.status(204).end();
}

export const internalGuard = requireSignature;
