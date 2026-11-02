import { env } from '../config/env.js';

export const mediaUrl = (key) => (key ? `${env.aws.mediaCdnUrl}/${key}` : null);
