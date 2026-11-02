const MB = 1024 * 1024;

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
