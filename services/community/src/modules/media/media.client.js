import { ApiError, internalClient } from '@playloop/kit';

const media = internalClient('MEDIA_URL');

export const takeUpload = (uploadId, userId, purpose) =>
  media.post('/internal/uploads/take', { uploadId, userId, purpose });

export async function resolveGameMedia(game, mediaIds, userId) {
  const existing = new Map(game.media.map((item) => [item._id.toString(), item]));
  const newIds = mediaIds.filter((id) => !existing.has(id));
  const { items } = newIds.length
    ? await media.post('/internal/uploads/game-media', {
        gameId: game._id,
        mediaIds: newIds,
        userId,
      })
    : { items: [] };
  const byUpload = new Map(items.map((upload) => [upload.id, upload]));
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
