import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

const STATUS_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'VALIDATION_ERROR',
  415: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return ApiError.validation(undefined, details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.validation(`Invalid value for ${err.path}`);
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0];
    return ApiError.conflict(field ? `${field} is already taken` : 'Already exists');
  }

  const status = err?.status ?? err?.statusCode;
  const code = STATUS_CODES[status];
  if (code === 'VALIDATION_ERROR') {
    const details = err.errors?.map((e) => ({ path: e.path, message: e.message }));
    return ApiError.validation(err.message, details);
  }
  if (code) {
    return new ApiError(status, code, code === 'NOT_FOUND' ? 'Not found' : err.message);
  }

  return null;
}

export function errorHandler(err, req, res, _next) {
  const apiError = toApiError(err);

  if (!apiError) {
    req.log.error({ err }, 'Unhandled error');
    return res
      .status(500)
      .json({ code: 'INTERNAL_ERROR', message: 'Something went wrong, please try again' });
  }

  const body = { code: apiError.code, message: apiError.message };
  if (apiError.details?.length) body.details = apiError.details;
  res.status(apiError.status).json(body);
}
