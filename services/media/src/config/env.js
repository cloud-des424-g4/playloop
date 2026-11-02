const read = (name, fallback) => process.env[name] || fallback;

export const env = Object.freeze({
  aws: {
    region: read('AWS_REGION', 'ap-southeast-1'),
    s3Endpoint: read('S3_ENDPOINT'),
    s3PublicEndpoint: read('S3_PUBLIC_ENDPOINT'),
    mediaBucket: read('S3_MEDIA_BUCKET'),
    buildsBucket: read('S3_BUILDS_BUCKET'),
    mediaCdnUrl: read('MEDIA_CDN_URL'),
  },
});
