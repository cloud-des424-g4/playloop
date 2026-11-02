const read = (name, fallback) => process.env[name] || fallback;

export const env = Object.freeze({
  aws: {
    region: read('AWS_REGION', 'ap-southeast-1'),
    s3Endpoint: read('S3_ENDPOINT'),
    mediaBucket: read('S3_MEDIA_BUCKET'),
    buildsBucket: read('S3_BUILDS_BUCKET'),
    playBucket: read('S3_PLAY_BUCKET'),
    mediaCdnUrl: read('MEDIA_CDN_URL'),
    playCdnUrl: read('PLAY_CDN_URL'),
    buildUnzipFunction: read('BUILD_UNZIP_FUNCTION'),
  },
  internalWebhookSecret: read('INTERNAL_WEBHOOK_SECRET'),
  payment: {
    secretKey: read('PAYMENT_SECRET_KEY'),
    webhookSecret: read('PAYMENT_WEBHOOK_SECRET'),
  },
});
