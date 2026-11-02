import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './stack.js';
import { env } from '../../community/src/config/env.js';
import { lambda } from '../../community/src/config/lambda.js';
import { Build } from '../../community/src/modules/builds/build.model.js';
import { Upload } from '../../community/src/modules/uploads/upload.model.js';
import { authCookie, createPublishedGame, createUser } from './helpers.js';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
  env.aws.buildUnzipFunction = undefined;
});

async function attachWebBuild() {
  const dev = await createUser();
  const game = await createPublishedGame(dev);
  const upload = await Upload.create({
    owner: dev._id,
    purpose: 'web_build',
    fileName: 'tempest-web.zip',
    contentType: 'application/zip',
    size: 4096,
    key: `uploads/${dev.id}/web/tempest-web.zip`,
    bucket: 'playloop-local-builds',
    status: 'uploaded',
    method: 'single',
    game: game._id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return request(app)
    .post(`/api/games/${game._id}/builds`)
    .set({ Cookie: authCookie(dev) })
    .send({ uploadId: upload.id, target: 'web' });
}

describe('starting web build processing', () => {
  it('invokes the unzip Lambda with the new build id', async () => {
    env.aws.buildUnzipFunction = 'playloop-dev-build-unzip';
    const send = vi.spyOn(lambda, 'send').mockResolvedValue({ StatusCode: 202 });

    const res = await attachWebBuild();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('processing');

    const { input } = send.mock.calls[0][0];
    expect(input).toMatchObject({
      FunctionName: 'playloop-dev-build-unzip',
      InvocationType: 'Event',
    });
    expect(JSON.parse(input.Payload)).toEqual({
      buildId: res.body.id,
      bucket: 'playloop-local-builds',
      key: expect.stringContaining('tempest-web.zip'),
    });
  });

  it('marks the build failed when the Lambda cannot be started', async () => {
    env.aws.buildUnzipFunction = 'playloop-dev-build-unzip';
    vi.spyOn(lambda, 'send').mockRejectedValue(new Error('AccessDenied'));

    const res = await attachWebBuild();
    expect(res.status).toBe(201);
    const build = await Build.findById(res.body.id);
    expect(build.status).toBe('failed');
    expect(build.error).toMatch(/upload again/);
  });

  it('leaves the build processing when no Lambda is configured', async () => {
    const send = vi.spyOn(lambda, 'send');
    const res = await attachWebBuild();
    expect(res.body.status).toBe('processing');
    expect(send).not.toHaveBeenCalled();
  });
});
