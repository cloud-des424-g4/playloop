import { createHmac } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import yauzl from 'yauzl';
import { BuildError, headersFor, planFiles } from './plan.js';
import { getWebhookSecret } from './webhook-secret.js';

// ZIP entry streams can emit small chunks; buffer them for S3 checksum framing.
const s3 = new S3Client({ requestStreamBufferSize: 65_536 });
const openZip = promisify(yauzl.open);
const PARALLEL_UPLOADS = 16;

function listEntries(zip) {
  return new Promise((resolve, reject) => {
    const entries = [];
    zip.on('entry', (entry) => {
      entries.push(entry);
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.on('error', reject);
    zip.readEntry();
  });
}

async function extract(file, buildId) {
  const zip = await openZip(file, { lazyEntries: true, autoClose: false });
  try {
    const { files, entryPath } = planFiles(await listEntries(zip));
    const openStream = promisify(zip.openReadStream.bind(zip));
    for (let i = 0; i < files.length; i += PARALLEL_UPLOADS) {
      await Promise.all(
        files.slice(i, i + PARALLEL_UPLOADS).map(async ({ entry, path }) =>
          s3.send(
            new PutObjectCommand({
              Bucket: process.env.PLAY_BUCKET,
              Key: `${buildId}/${path}`,
              Body: await openStream(entry),
              ContentLength: entry.uncompressedSize,
              CacheControl: 'public, max-age=31536000, immutable',
              ...headersFor(path),
            }),
          ),
        ),
      );
    }
    return entryPath;
  } finally {
    zip.close();
  }
}

async function report(buildId, result, secret) {
  const body = JSON.stringify(result);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  const res = await fetch(`${process.env.API_URL}/api/internal/builds/${buildId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-PlayLoop-Signature': signature },
    body,
  });
  if (!res.ok) throw new Error(`Status callback failed with ${res.status}`);
}

export async function handler({ buildId, bucket, key }) {
  const secret = await getWebhookSecret();
  const file = join(tmpdir(), `${buildId}.zip`);
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    await pipeline(object.Body, createWriteStream(file));
    const entryPath = await extract(file, buildId);
    await report(buildId, { status: 'ready', entryPath }, secret);
  } catch (err) {
    console.error(JSON.stringify({ buildId, error: err.message }));
    const error = err instanceof BuildError ? err.message : 'Could not process this build';
    await report(buildId, { status: 'failed', error }, secret);
  } finally {
    await rm(file, { force: true });
  }
}
