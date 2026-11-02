import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

const options = {
  region: env.aws.region,
  ...(env.aws.s3Endpoint && { endpoint: env.aws.s3Endpoint, forcePathStyle: true }),
};

export const s3 = new S3Client(options);

// Inside Compose, S3_ENDPOINT is a container name that a browser can't reach
export const s3Presign = env.aws.s3PublicEndpoint
  ? new S3Client({ ...options, endpoint: env.aws.s3PublicEndpoint })
  : s3;
