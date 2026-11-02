import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { s3 } from '../../config/s3.js';
import { ApiError } from '@playloop/kit';
import { mediaUrl } from '../../utils/mediaUrl.js';
import { Game } from '../games/game.model.js';
import { Review } from '../reviews/review.model.js';
import { Upload } from './upload.model.js';

const MB = 1024 * 1024;
const PART_SIZE = 50 * MB;
const MULTIPART_FROM = 100 * MB;
const HOUR = 60 * 60 * 1000;

const kind = (types, max, exts) => ({ types, max, exts });

export const UPLOAD_RULES = {
  avatar: [kind(['image/jpeg', 'image/png'], 2 * MB, ['jpg', 'jpeg', 'png'])],
  game_media: [
    kind(['image/jpeg', 'image/png'], 5 * MB, ['jpg', 'jpeg', 'png']),
    kind(['video/mp4'], 100 * MB, ['mp4']),
  ],
  game_background: [kind(['image/jpeg', 'image/png'], 5 * MB, ['jpg', 'jpeg', 'png'])],
  proof_screenshot: [kind(['image/jpeg', 'image/png'], 5 * MB, ['jpg', 'jpeg', 'png'])],
  web_build: [kind(['application/zip', 'application/x-zip-compressed'], 500 * MB, ['zip'])],
  download_build: [
    kind(
      [
        'application/zip',
        'application/x-zip-compressed',
        'application/vnd.microsoft.portable-executable',
        'application/x-msdownload',
        'application/octet-stream',
        'application/x-apple-diskimage',
        'application/gzip',
        'application/x-gtar',
      ],
      2 * 1024 * MB,
      ['zip', 'exe', 'dmg', 'tar.gz'],
    ),
  ],
};

const NEEDS_GAME = new Set(['game_media', 'game_background', 'web_build', 'download_build']);
const PRIVATE = new Set(['proof_screenshot', 'web_build', 'download_build']);

const bucketFor = (purpose) => (PRIVATE.has(purpose) ? env.aws.buildsBucket : env.aws.mediaBucket);

const extension = (fileName) => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  return lower.split('.').pop();
};

function matchingRule(purpose, fileName, contentType, size) {
  const rules = UPLOAD_RULES[purpose];
  const ext = extension(fileName);
  return rules?.find(
    (rule) => rule.exts.includes(ext) && rule.types.includes(contentType) && size <= rule.max,
  );
}

async function ownedGame(gameId, userId) {
  const game = await Game.findOne({ _id: gameId, deletedAt: null, removedAt: null });
  if (!game) throw ApiError.notFound('Game not found');
  if (!game.owner.equals(userId)) throw ApiError.forbidden();
  return game;
}

async function ownedReview(reviewId, userId) {
  const review = await Review.findById(reviewId);
  if (!review || review.removedAt) throw ApiError.notFound('Review not found');
  if (!review.reviewer.equals(userId)) throw ApiError.forbidden();
  if (review.status !== 'in_progress') {
    throw ApiError.conflict('This review is already submitted');
  }
  return review;
}

const safeName = (fileName) => fileName.replace(/[^\w.\- ]+/g, '_').slice(-80);

export function uploadLimitsForMeta() {
  const one = (rules) => rules.map((rule) => ({ contentTypes: rule.types, maxBytes: rule.max }));
  return {
    avatar: one(UPLOAD_RULES.avatar),
    game_media: one(UPLOAD_RULES.game_media),
    game_background: one(UPLOAD_RULES.game_background),
    proof_screenshot: one(UPLOAD_RULES.proof_screenshot),
    web_build: one(UPLOAD_RULES.web_build),
    download_build: one(UPLOAD_RULES.download_build),
  };
}

export async function createUpload(userId, input) {
  const { purpose, fileName, contentType, size, gameId, reviewId } = input;
  if (!matchingRule(purpose, fileName, contentType, size)) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/fileName', message: 'File type or size is not allowed for this upload' },
    ]);
  }
  if (NEEDS_GAME.has(purpose) && !gameId) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/gameId', message: 'gameId is required' },
    ]);
  }
  if (purpose === 'proof_screenshot' && !reviewId) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/reviewId', message: 'reviewId is required' },
    ]);
  }

  if (gameId) await ownedGame(gameId, userId);
  if (reviewId) await ownedReview(reviewId, userId);

  const bucket = bucketFor(purpose);
  if (!bucket) throw ApiError.validation('File storage is not configured');

  const upload = await Upload.create({
    owner: userId,
    purpose,
    fileName,
    contentType,
    size,
    key: 'pending',
    bucket,
    method: size > MULTIPART_FROM ? 'multipart' : 'single',
    game: gameId,
    review: reviewId,
    expiresAt: new Date(Date.now() + 24 * HOUR),
  });
  upload.key = `uploads/${userId}/${upload._id}/${safeName(fileName)}`;
  await upload.save();

  const expiresAt = new Date(Date.now() + HOUR);
  if (upload.method === 'single') {
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: upload.key,
        ContentType: contentType,
        ContentLength: size,
      }),
      { expiresIn: 3600 },
    );
    return {
      id: upload._id.toString(),
      purpose,
      method: 'single',
      url,
      headers: { 'Content-Type': contentType },
      expiresAt,
    };
  }

  const created = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: upload.key, ContentType: contentType }),
  );
  upload.s3UploadId = created.UploadId;
  await upload.save();
  const partCount = Math.ceil(size / PART_SIZE);
  const parts = await Promise.all(
    Array.from({ length: partCount }, async (_, index) => ({
      partNumber: index + 1,
      url: await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: bucket,
          Key: upload.key,
          UploadId: created.UploadId,
          PartNumber: index + 1,
        }),
        { expiresIn: 3600 },
      ),
    })),
  );
  return {
    id: upload._id.toString(),
    purpose,
    method: 'multipart',
    partSize: PART_SIZE,
    parts,
    expiresAt,
  };
}

async function assertStored(upload) {
  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: upload.bucket, Key: upload.key }));
  } catch {
    throw ApiError.validation('The file was not uploaded', [
      { path: '/body', message: 'Upload the file before confirming it' },
    ]);
  }
  if (Number(head.ContentLength) !== upload.size) {
    throw ApiError.validation('The file was not uploaded', [
      { path: '/body', message: 'Uploaded file size does not match' },
    ]);
  }
}

export async function completeUpload(userId, uploadId, { parts } = {}) {
  const upload = await Upload.findById(uploadId);
  if (!upload || !upload.owner.equals(userId)) throw ApiError.notFound('Upload not found');
  if (upload.status === 'uploaded') throw ApiError.conflict('Upload is already complete');
  if (upload.expiresAt < new Date()) {
    throw ApiError.validation('Upload expired', [
      { path: '/body', message: 'This upload expired. Start again.' },
    ]);
  }

  if (upload.method === 'multipart') {
    if (!parts?.length) {
      throw ApiError.validation('Some fields are invalid', [
        { path: '/body/parts', message: 'Multipart uploads need the part list' },
      ]);
    }
    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: upload.bucket,
        Key: upload.key,
        UploadId: upload.s3UploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  await assertStored(upload);
  upload.status = 'uploaded';
  await upload.save();
  return toUpload(upload);
}

export function toUpload(upload) {
  return {
    id: upload._id.toString(),
    purpose: upload.purpose,
    status: upload.status,
    fileName: upload.fileName,
    contentType: upload.contentType,
    size: upload.size,
    url: PRIVATE.has(upload.purpose) ? null : mediaUrl(upload.key),
    createdAt: upload.createdAt,
  };
}

export async function proofUrl(key) {
  if (!key || !env.aws.buildsBucket) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.aws.buildsBucket, Key: key }), {
    expiresIn: 900,
  });
}

export async function takeUpload(uploadId, userId, purpose) {
  const upload = await Upload.findOne({
    _id: uploadId,
    owner: userId,
    purpose,
    status: 'uploaded',
    expiresAt: { $gt: new Date() },
  });
  if (!upload) {
    throw ApiError.validation('Upload is not ready', [
      { path: '/body', message: 'Complete the upload first' },
    ]);
  }
  return upload;
}

export async function resolveGameMedia(game, mediaIds, userId) {
  const uploads = await Upload.find({
    _id: { $in: mediaIds },
    owner: userId,
    purpose: 'game_media',
    status: 'uploaded',
    game: game._id,
  });
  const byUpload = new Map(uploads.map((upload) => [upload._id.toString(), upload]));
  const existing = new Map(game.media.map((item) => [item._id.toString(), item]));
  return mediaIds.map((id) => {
    if (existing.has(id)) return existing.get(id);
    const upload = byUpload.get(id);
    if (!upload) {
      throw ApiError.validation('Some fields are invalid', [
        {
          path: '/body/mediaIds',
          message: 'Each media id must be a completed upload or an existing file',
        },
      ]);
    }
    return {
      type: upload.contentType.startsWith('video/') ? 'video' : 'image',
      key: upload.key,
    };
  });
}
