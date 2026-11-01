import { api } from './api.js';

const EXTENSION_TYPES = {
  zip: 'application/zip',
  exe: 'application/x-msdownload',
  dmg: 'application/x-apple-diskimage',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp4: 'video/mp4',
};

// Browsers leave file.type empty for some build files; fall back on the extension.
export function contentTypeOf(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  return file.type || EXTENSION_TYPES[extension] || 'application/octet-stream';
}

// Uploads a file straight to storage (docs/api paths/uploads.yaml): ask for a ticket, PUT the bytes
// (in parts for large files), then confirm. Returns the completed Upload.
export async function uploadFile({ purpose, file, gameId, reviewId }) {
  const contentType = contentTypeOf(file);
  const ticket = await api.post('/uploads', {
    purpose,
    fileName: file.name,
    contentType,
    size: file.size,
    ...(gameId && { gameId }),
    ...(reviewId && { reviewId }),
  });
  let parts;
  if (ticket.method === 'multipart') {
    parts = [];
    for (const part of ticket.parts) {
      const start = (part.partNumber - 1) * ticket.partSize;
      const response = await fetch(part.url, {
        method: 'PUT',
        body: file.slice(start, start + ticket.partSize),
      });
      if (!response.ok) throw new Error(`${file.name} could not be uploaded. Try again.`);
      parts.push({ partNumber: part.partNumber, etag: response.headers.get('ETag') });
    }
  } else {
    const response = await fetch(ticket.url, {
      method: 'PUT',
      headers: ticket.headers,
      body: file,
    });
    if (!response.ok) throw new Error(`${file.name} could not be uploaded. Try again.`);
  }
  return api.post(`/uploads/${ticket.id}/complete`, parts ? { parts } : {});
}
