import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { s3, s3Presign } from '../../config/s3.js';
import { ApiError, internalClient } from '@playloop/kit';
import { UPLOAD_RULES } from '@playloop/shared';
import { mediaUrl } from '../../utils/mediaUrl.js';
import { Upload } from './upload.model.js';

const community = internalClient('COMMUNITY_URL');

const MB = 1024 * 1024;
const PART_SIZE = 50 * MB;
const MULTIPART_FROM = 100 * MB;
const HOUR = 60 * 60 * 1000;

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

const safeName = (fileName) => fileName.replace(/[^\w.\- ]+/g, '_').slice(-80);

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

  if (gameId || reviewId) {
    await community.post('/internal/upload-targets/check', { userId, gameId, reviewId });
  }

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
      s3Presign,
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
        s3Presign,
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
  return {
    id: upload._id.toString(),
    key: upload.key,
    bucket: upload.bucket,
    fileName: upload.fileName,
    size: upload.size,
    contentType: upload.contentType,
    game: upload.game?.toString() ?? null,
    review: upload.review?.toString() ?? null,
  };
}

export async function gameMedia({ gameId, mediaIds, userId }) {
  const uploads = await Upload.find({
    _id: { $in: mediaIds },
    owner: userId,
    purpose: 'game_media',
    status: 'uploaded',
    game: gameId,
  });
  return uploads.map((upload) => ({
    id: upload._id.toString(),
    key: upload.key,
    contentType: upload.contentType,
  }));
}
