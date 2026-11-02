import { GetObjectCommand } from '@aws-sdk/client-s3';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';
import { lambda } from '../../config/lambda.js';
import { s3 } from '../../config/s3.js';
import { ApiError, logger } from '@playloop/kit';
import { notify } from '../notifications/notification.service.js';
import { Game } from '../games/game.model.js';
import { takeUpload } from '../uploads/upload.service.js';
import { Build } from './build.model.js';

const DOWNLOAD_TARGETS = {
  windows: 'download_build',
  mac: 'download_build',
  linux: 'download_build',
};

export async function attachBuilds(game) {
  game.$locals.builds = await Build.find({ game: game._id });
  return game;
}

export function toBuild(build) {
  return {
    id: build._id.toString(),
    target: build.target,
    status: build.status,
    fileName: build.fileName,
    size: build.size,
    version: build.version,
    uploadedAt: build.createdAt,
    error: build.error,
    playUrl: build.playUrl,
  };
}

export function downloadOptions(builds = []) {
  return builds
    .filter((build) => build.status === 'ready' && build.target !== 'web')
    .map((build) => ({
      buildId: build._id.toString(),
      target: build.target,
      fileName: build.fileName,
      size: build.size,
      version: build.version,
    }));
}

export function webPlayUrl(game) {
  const ready = (game.$locals.builds ?? []).find(
    (build) => build.target === 'web' && build.status === 'ready' && build.playUrl,
  );
  return ready?.playUrl ?? null;
}

async function ownedGame(gameId, userId) {
  const game = await Game.findOne({ _id: gameId, deletedAt: null, removedAt: null });
  if (!game) throw ApiError.notFound('Game not found');
  if (!game.owner.equals(userId)) throw ApiError.forbidden();
  return game;
}

export async function addBuild(gameId, userId, { uploadId, target }) {
  const game = await ownedGame(gameId, userId);
  const purpose = target === 'web' ? 'web_build' : DOWNLOAD_TARGETS[target];
  const upload = await takeUpload(uploadId, userId, purpose);
  if (upload.game && !upload.game.equals(game._id)) {
    throw ApiError.validation('Some fields are invalid', [
      { path: '/body/uploadId', message: 'This upload belongs to another game' },
    ]);
  }

  await Build.deleteOne({ game: game._id, target });
  const build = await Build.create({
    game: game._id,
    owner: userId,
    target,
    status: target === 'web' ? 'processing' : 'ready',
    fileName: upload.fileName,
    size: upload.size,
    version: game.version,
    key: upload.key,
    bucket: upload.bucket,
  });
  if (target === 'web') await startUnzip(build);
  return build;
}

async function startUnzip(build) {
  const functionName = env.aws.buildUnzipFunction;
  if (!functionName) {
    // shortcut: without BUILD_UNZIP_FUNCTION (local dev) web builds stay processing, set it once the Lambda is deployed
    logger.warn(
      { buildId: build.id },
      'BUILD_UNZIP_FUNCTION is not set, web build left processing',
    );
    return;
  }
  try {
    await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify({ buildId: build.id, bucket: build.bucket, key: build.key }),
      }),
    );
  } catch (err) {
    logger.error({ err, buildId: build.id }, 'Could not start web build processing');
    build.set({ status: 'failed', error: 'Could not start processing, please upload again' });
    await build.save();
  }
}

export async function deleteBuild(gameId, userId, buildId) {
  const game = await ownedGame(gameId, userId);
  const build = await Build.findOne({ _id: buildId, game: game._id });
  if (!build) throw ApiError.notFound('Build not found');

  if (game.status === 'published') {
    const remaining = await Build.find({
      game: game._id,
      _id: { $ne: build._id },
      status: 'ready',
    });
    const stillWorks =
      game.delivery.method === 'web'
        ? Boolean(game.delivery.webUrl) || remaining.some((item) => item.target === 'web')
        : remaining.some((item) => item.target !== 'web');
    if (!stillWorks) {
      throw ApiError.conflict('A published game must keep a build or a web link');
    }
  }
  await build.deleteOne();
}

export async function downloadLink(gameId, user, buildId) {
  const game = await Game.findOne({ _id: gameId, deletedAt: null, removedAt: null });
  if (!game) throw ApiError.notFound('Game not found');
  const isOwner = game.owner.equals(user.id);
  if (game.status !== 'published' && !isOwner) throw ApiError.notFound('Game not found');
  if (game.hiddenAt && user.role !== 'admin' && !isOwner) throw ApiError.notFound('Game not found');

  const build = await Build.findOne({ _id: buildId, game: game._id, status: 'ready' });
  if (!build) throw ApiError.notFound('Build not found');

  const expiresIn = 15 * 60;
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: build.bucket,
      Key: build.key,
      ResponseContentDisposition: `attachment; filename="${build.fileName}"`,
    }),
    { expiresIn },
  );
  return {
    url,
    fileName: build.fileName,
    size: build.size,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

export async function setBuildStatus(buildId, { status, error, entryPath }) {
  const build = await Build.findById(buildId);
  if (!build) throw ApiError.notFound('Build not found');
  if (build.status === status) return;

  build.status = status;
  build.error = status === 'failed' ? (error ?? 'Build processing failed') : null;
  if (status === 'ready' && build.target === 'web') {
    const base = env.aws.playCdnUrl || 'http://localhost:9000/playloop-local-play';
    const entry = (entryPath || 'index.html').replace(/^\/+/, '');
    build.playUrl = `${base}/${build._id}/${entry}`;
  }
  await build.save();

  const game = await Game.findById(build.game).select('title');
  await notify({
    user: build.owner,
    type: status === 'ready' ? 'build_ready' : 'build_failed',
    message:
      status === 'ready'
        ? `${game?.title ?? 'Your game'}'s web build is ready to play`
        : `${game?.title ?? 'Your game'}'s web build failed: ${build.error}`,
    link: `/games/${build.game}/edit`,
    game: build.game,
  });
}
