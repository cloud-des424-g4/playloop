import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { s3Presign } from '../config/s3.js';

export async function proofUrl(key) {
  if (!key || !env.aws.buildsBucket) return null;
  return getSignedUrl(s3Presign, new GetObjectCommand({ Bucket: env.aws.buildsBucket, Key: key }), {
    expiresIn: 900,
  });
}
