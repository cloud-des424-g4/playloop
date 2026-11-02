# PlayLoop microservices implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Express backend into Identity, Community, Notifications and Media behind an Nginx gateway, with the public API unchanged.

**Architecture:** Each service is a workspace package with its own database and Docker image. Shared infrastructure lives in `services/kit`. Services call each other over signed HTTP, and Community delivers notifications through an outbox.

**Tech Stack:** Node 22 (ESM), Express 5, Mongoose 9, Vitest, Nginx, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-02-microservices-design.md`

## Global Constraints

- Add no runtime dependency that `server/package.json` doesn't already have.
- Write no code comments, except one short line for a non-obvious reason.
- Commit after each task on `feature/microservices`. Never push. Never touch `frontend` or `feature/auth-pages`.
- Commit messages are imperative sentence case, such as `Add signed internal client`. They carry no `Co-Authored-By` line, no AI attribution and no people's names.
- The public API stays the same, apart from the new 503 `SERVICE_UNAVAILABLE` error.
- Ports: Identity 4001, Community 4002, Notifications 4003, Media 4004, gateway 80 (published as 4000 locally).
- Databases: `playloop_identity`, `playloop_community`, `playloop_notifications`, `playloop_media`.
- Internal calls sign `${timestamp}\n${method}\n${path}\n${body}` with HMAC-SHA256 and `INTERNAL_SERVICE_SECRET`. The window is 60 seconds and the timeout is 3 seconds.
- Every task ends with `npm run lint`, `npm run format:check`, `npm run spec:lint` and `npm test` all passing, except the known `health.yaml` spec warning.

## Review Focus

1. Someone retries registration after a 503. The same username must work, with no leftover `User`. Pinned in Task 5.
2. A notification can never be delivered, such as a bad payload. Newer notifications must still go out. Pinned in Task 3.
3. A valid cookie belongs to a user with no `Member`, such as after a Community database reset. The API must answer 401, not 500. Pinned in Task 5.
4. A service restarts and gets a new container IP. The gateway must recover without its own restart. Pinned in Task 6.
5. A crafted path such as `/api/../internal/...` is sent to the gateway. It must return 404. Pinned in Task 6.

---

## Task 1: Create the kit and move the backend

**Files:**

- Move: `server/` to `services/community/`, and `services/community/test/` plus `vitest.config.js` to `services/stack-tests/`
- Create: `services/kit/package.json`, `services/kit/src/{index,env,ApiError,logger,db,errorHandler,notFound,rateLimit,openapi,session,health,createServiceApp,startService}.js`
- Create: `services/stack-tests/package.json`, `services/stack-tests/test/stack.js`, `services/stack-tests/test/kit.test.js`
- Delete: Community's `utils/ApiError.js`, `utils/logger.js`, `config/db.js`, `middleware/{errorHandler,notFound,rateLimit,openapi}.js`, `modules/health/`
- Modify: `services/community/src/{app,server,routes}.js`, `middleware/auth.js`, `config/env.js`, and module imports of the deleted files
- Modify: `docs/api/schemas/Error.yaml`, root `package.json`, `package-lock.json`

**Interfaces:**

- Produces from `@playloop/kit`:
  - `env`: `{ nodeEnv, isProduction, logLevel, jwtSecret, jwtExpiresIn, clientOrigins }`
  - `assertEnv(extraNames: string[] = [])`, requiring `MONGODB_URI`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET` and the extras
  - `ApiError`, with new `ApiError.unavailable(message = 'This service is unavailable, please try again')` giving status 503 and code `SERVICE_UNAVAILABLE`
  - `logger`, `connectDb(uri)`, `disconnectDb()`, `dbState()`, `errorHandler`, `notFound`, `rateLimit`, `createRateLimiter`
  - `SESSION_COOKIE`, `signSessionToken(user)`, `setSessionCookie(res, user)`, `clearSessionCookie(res)`, `accountBlockMessage(account)`
  - `createAuth(loadAccount: (id) => Promise<{ role, status, suspension } | null>)` returning `{ requireAuth, optionalAuth, requireAdmin }`, with `req.user` set to `{ id, role }` and `id` taken from the token's `sub`
  - `createServiceApp({ routes, internalRoutes, docs = false }): express.Application`
  - `startService({ name, defaultPort, createApp, onStart, onStop }): Promise<void>`
- Produces from `services/stack-tests/test/stack.js`: `createApp()`, a request handler that picks the service from a `ROUTES` list of `[pathPrefix, serviceName]`, plus `startStack()` and `stopStack()`, called from `setup.js`

- [ ] **Step 1: Move the code and tests with `git mv`**

Set the root workspaces to `["client", "shared", "services/*", "lambdas/*"]`. Rename the package to `@playloop/community`. Move test-only dev dependencies to `@playloop/stack-tests`. Point the root `test` script at `@playloop/stack-tests` and the two Lambdas, and the root `dev`, `start` and `seed` scripts at `@playloop/community`. Run `npm install`.

- [ ] **Step 2: Point the tests at the moved code**

Create `stack.js` with one route, `['/api', 'community']`. Replace `'../src/app.js'` with `'./stack.js'` in every test, and `'../src/` with `'../../community/src/` in the rest. Add `INTERNAL_SERVICE_SECRET: 'test-service-secret'` to the Vitest env.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: 118 server tests pass, plus 5 and 2 Lambda tests.

- [ ] **Step 4: Write the failing kit tests in `kit.test.js`**

```js
it('returns SERVICE_UNAVAILABLE as JSON with response validation on', async () => {
  const routes = Router();
  routes.get('/games', () => {
    throw ApiError.unavailable();
  });
  const res = await request(createServiceApp({ routes })).get('/api/games');
  expect(res.status).toBe(503);
  expect(res.body).toEqual({
    code: 'SERVICE_UNAVAILABLE',
    message: 'This service is unavailable, please try again',
  });
});

it('reads the proxy hop count when the app is created', () => {
  process.env.TRUST_PROXY_HOPS = '2';
  expect(createServiceApp({ routes: Router() }).get('trust proxy')).toBe(2);
  delete process.env.TRUST_PROXY_HOPS;
  expect(createServiceApp({ routes: Router() }).get('trust proxy')).toBe(1);
});

it('reports its own database on /api/health', async () => {
  const res = await request(createServiceApp({ routes: Router() })).get('/api/health');
  expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
});
```

- [ ] **Step 5: Run them and confirm they fail because `@playloop/kit` doesn't exist**

Run: `npm test -w @playloop/stack-tests -- test/kit.test.js`
Expected: FAIL on the missing package.

- [ ] **Step 6: Build `services/kit` from the moved files**

`createServiceApp` keeps the order in today's `app.js`, reads `TRUST_PROXY_HOPS` with a default of 1, mounts `/api/health` itself, mounts `/internal` before the validator when `internalRoutes` is given, and mounts `/api/docs` when `docs` is true and not in production. Add `SERVICE_UNAVAILABLE` to the `Error.yaml` enum. Pass the validator `validateResponses: { onError }`, where `onError` ignores bodies with code `SERVICE_UNAVAILABLE` or `INTERNAL_ERROR` and rethrows the rest. Use `false` in production.

- [ ] **Step 7: Switch Community to the kit**

Replace the deleted imports with `@playloop/kit`. Community's `middleware/auth.js` becomes `createAuth((id) => User.findById(id).select('role status suspension'))` plus re-exports, so its 12 importers don't change. Fields that moved to the kit's `env` are `nodeEnv`, `isProduction`, `logLevel`, `jwtSecret`, `jwtExpiresIn` and `clientOrigins`. `server.js` becomes one `startService` call.

- [ ] **Step 8: Run all checks**

Run: `npm run lint && npm run format:check && npm run spec:lint && npm test`
Expected: all pass, with 121 server tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Move backend to services and add shared kit"
```

## Task 2: Add the signed internal client and guard

**Files:**

- Create: `services/kit/src/internal.js`, `services/kit/src/context.js`
- Modify: `services/kit/src/{index,createServiceApp}.js`
- Test: `services/stack-tests/test/kit-internal.test.js`

**Interfaces:**

- Produces from `@playloop/kit`:
  - `signInternal({ method, path, body, timestamp }): string`
  - `internalGuard(req, res, next)`, applied by `createServiceApp` to everything under `/internal`
  - `internalClient(urlEnvName: string, { timeoutMs = 3000 } = {})` returning `{ get(path), post(path, body), put(path, body) }`. Each resolves to parsed JSON, or `null` for 204. The base URL is read from `process.env[urlEnvName]` on each call.
  - `currentRequestId(): string | undefined`

- [ ] **Step 1: Write the failing tests against a real Express server**

Test names, each with the status or error it asserts:

- `accepts a signed call`: 200 with the body returned
- `rejects a changed body`: 401
- `rejects a signature from another secret`: 401
- `rejects a timestamp 61 seconds old`: 401
- `passes a 404 through unchanged`: rejects with `{ status: 404, code: 'NOT_FOUND', message: 'Game not found' }`
- `passes a 400 with details through unchanged`: `err.details` deep equals the callee's
- `turns a 500 into SERVICE_UNAVAILABLE`: status 503
- `turns a closed port into SERVICE_UNAVAILABLE`: base URL `http://127.0.0.1:9`, status 503
- `turns a timeout into SERVICE_UNAVAILABLE`: `timeoutMs: 50` against a route that never answers, status 503
- `forwards the request id`: a route that calls the client sends `X-Request-Id: abc`, and the callee sees `abc`

- [ ] **Step 2: Run them and confirm they fail on the missing exports**

Run: `npm test -w @playloop/stack-tests -- test/kit-internal.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `internal.js` and `context.js`**

Use `AbortSignal.timeout` for the timeout and `timingSafeEqual` for the comparison. The guard reads `req.originalUrl` and `req.rawBody ?? ''`. `context.js` wraps each request in `AsyncLocalStorage`, and `pinoHttp` takes `genReqId` from `x-request-id`, falling back to `randomUUID()`.

- [ ] **Step 4: Run all checks, as in Task 1 Step 8**

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add signed internal client and guard"
```

## Task 3: Extract Notifications with the outbox

**Files:**

- Create: `services/notifications/package.json`, `src/{app,server}.js`, `src/middleware/auth.js`, `src/internal.routes.js`
- Move: `services/community/src/modules/notifications/` to `services/notifications/src/modules/notifications/`
- Create: `services/community/src/modules/outbox/{outbox.model,outbox.service}.js`
- Create: `services/community/src/modules/internal/{service.routes,refs.service}.js`
- Modify: `services/community/src/{app,server}.js`, `modules/users/me.routes.js`, and the `notify` imports in the admin, builds, discussions, reputation and reviews services
- Test: `services/stack-tests/test/outbox.test.js`, plus changes to `stack.js` and the five tests that read notifications

**Interfaces:**

- Consumes: `createServiceApp`, `createAuth`, `internalClient`, `ApiError`
- Produces in Community:
  - `Outbox` model: `{ payload: Mixed, attempts: Number = 0, nextAttemptAt: Date = now, createdAt }`, indexed on `nextAttemptAt`
  - `notify(input, session): Promise<Outbox>`, same arguments as today, with ids stored as strings
  - `retryDelayMs(attempts: number): number`, equal to `min(2 ** attempts, 300) * 1000`
  - `flushOutbox({ limit = 50, now = new Date() } = {}): Promise<{ sent: number, failed: number }>`
  - `startOutbox(intervalMs = 1000)`, which skips a tick while a run is active, and `stopOutbox(): Promise<void>`
  - `refs({ users: string[], games: string[] })` returning `{ users: { [id]: UserSummary }, games: { [id]: { id, title, coverUrl, deleted } } }`
  - `serviceRoutes` under `/internal`: `POST /refs`, and for now `GET /accounts/:id/access`, which returns `{ role, status, suspension }` or 404 and moves to Identity in Task 5
- Produces in Notifications: `toNotification(notification, refs)`, `deliverNotification({ id, createdAt, user, type, message, link, actor, game, reviewId })`, and `POST /internal/notifications`, which upserts by `_id` with `$setOnInsert`
- Produces in `stack.js`: `settle()`, which runs `flushOutbox()`, and `withServiceDown(name, fn)`, which points `${NAME}_URL` at `http://127.0.0.1:9` while `fn` runs. The harness sets `IDENTITY_URL`, `COMMUNITY_URL` and `NOTIFICATIONS_URL`, with `IDENTITY_URL` on Community until Task 5.

- [ ] **Step 1: Write the failing tests in `outbox.test.js`**

Test names and assertions:

- `delivers a row from a committed transaction`: write inside `mongoose.connection.transaction`, run `settle()`, then one `Notification` exists and `Outbox` is empty
- `drops a row from an aborted transaction`: throw inside the transaction, then `settle()` gives `{ sent: 0, failed: 0 }`
- `keeps a failed row and schedules a retry`: inside `withServiceDown('notifications', ...)`, `flushOutbox()` gives `{ sent: 0, failed: 1 }`, with `attempts` 1 and `nextAttemptAt` 2 seconds after `now`
- `caps the retry delay at 300 seconds`: `retryDelayMs(1)` is 2000 and `retryDelayMs(9)` is 300000
- `doesn't duplicate a repeated delivery`: post the same id twice to `/internal/notifications`, then one `Notification` exists
- `keeps the original time on a late delivery`: an outbox `createdAt` of yesterday is the notification's `createdAt`
- `a row that can't be delivered doesn't block newer rows` (Review Focus 2): an older row with no `message` and a newer good row give `{ sent: 1, failed: 1 }`, and the good notification exists

Add to `notifications.test.js`:

- `lists notifications without actor and game when Community is down`: inside `withServiceDown('community', ...)`, the status is 200, the message is present, and `actor` and `game` are undefined
- `reports a removed game as deleted`: after the game gets `deletedAt`, `items[0].game.deleted` is `true`

- [ ] **Step 2: Run them and confirm they fail on the missing outbox module**

Run: `npm test -w @playloop/stack-tests -- test/outbox.test.js test/notifications.test.js`
Expected: FAIL.

- [ ] **Step 3: Build the outbox and `refs` in Community**

Move `gameRef` to `refs.service.js`. Point every `notify` import at `../outbox/outbox.service.js`. `flushOutbox` selects rows with `nextAttemptAt <= now`, sorted by `createdAt`, and handles them one at a time so one failure can't stop the batch. Call `startOutbox` and `stopOutbox` from `onStart` and `onStop` in `server.js`.

- [ ] **Step 4: Build the Notifications service**

Remove `ref` from the model and the `populate` calls from `listNotifications`. Move the four routes from `me.routes.js` to `/me/notifications` here. The list route calls `POST /internal/refs` and treats a 503 as empty refs. `toNotification` adds `actor` and `game` only when `refs` has them. Auth loads accounts with `identity.get('/internal/accounts/:id/access')`, and a 404 becomes `null`.

- [ ] **Step 5: Add Notifications to the harness**

Add `['/api/me/notifications', 'notifications']` to `ROUTES`. Add `await settle()` before notification reads in `community`, `phase3`, `notifications`, `platform` and `reviewer-of-the-month`, and update the `Notification` import path.

- [ ] **Step 6: Run all checks, as in Task 1 Step 8**

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Extract notifications service with outbox delivery"
```

## Task 4: Extract Media

**Files:**

- Create: `services/media/package.json`, `src/{app,server}.js`, `src/config/{env,s3}.js`, `src/middleware/auth.js`, `src/utils/mediaUrl.js`, `src/internal.routes.js`
- Move: `services/community/src/modules/uploads/` to `services/media/src/modules/uploads/`
- Create: `shared/src/uploads.js`, `services/community/src/modules/media/media.client.js`, `services/community/src/modules/games/upload-target.service.js`, `services/community/src/utils/proofUrl.js`
- Modify: `shared/src/index.js`, Community's `routes.js`, `modules/internal/service.routes.js`, `modules/meta/meta.controller.js`, and the builds, games, reviews and users services
- Test: `services/stack-tests/test/media.test.js`, plus changes to `stack.js`, `phase3`, `profiles` and `build-unzip`

**Interfaces:**

- Consumes: `createServiceApp`, `createAuth`, `internalClient`
- Produces from `@playloop/shared`: `UPLOAD_RULES`, `uploadLimitsForMeta()`
- Produces in Community:
  - `takeUpload(uploadId, userId, purpose)` returning `{ id, key, bucket, fileName, size, contentType, game: string | null, review: string | null }`
  - `resolveGameMedia(game, mediaIds, userId)`, same result and same validation error as today
  - `proofUrl(key): Promise<string | null>`
  - `checkUploadTarget({ userId, gameId, reviewId }): Promise<void>`, throwing today's 404, 403 and 409 errors, exposed as `POST /internal/upload-targets/check`
- Produces in Media: `POST /internal/uploads/take`, with body `{ uploadId, userId, purpose }`, and `POST /internal/uploads/game-media`, with body `{ gameId, mediaIds, userId }` and response `{ items: [{ id, key, contentType }] }`

- [ ] **Step 1: Write the failing tests in `media.test.js`**

Test names and assertions:

- `rejects an upload for someone else's game through Media`: 403 from `POST /api/uploads`
- `rejects a proof upload for a submitted review`: 409
- `uses a finished upload as an avatar`: `PATCH /api/me` with `avatarUploadId` returns an `avatarUrl` that contains the upload key
- `refuses an upload that isn't finished`: 400 with `Upload is not ready`
- `leaves the game unchanged when Media is down`: inside `withServiceDown('media', ...)`, a save with new `mediaIds` gets 503 and `game.media` is unchanged
- `serves upload limits with Media down`: `GET /api/meta` is 200 with `uploadLimits` present

- [ ] **Step 2: Run them and confirm the new routing and failure tests fail**

Run: `npm test -w @playloop/stack-tests -- test/media.test.js`
Expected: FAIL on `withServiceDown('media', ...)`, because Community still reads `Upload` directly.

- [ ] **Step 3: Move `UPLOAD_RULES` and `uploadLimitsForMeta` to `shared/src/uploads.js`**

Point Media and `meta.controller.js` at `@playloop/shared`.

- [ ] **Step 4: Build the Media service**

Replace `ownedGame` and `ownedReview` with a call to `/internal/upload-targets/check`. Move `proofUrl` to Community's `utils/proofUrl.js`. Remove `/uploads` from Community's routes. Remove `ref` from the `Upload` fields.

- [ ] **Step 5: Add the Community side**

Add `media.client.js` and `upload-target.service.js`. Change `upload.game.equals(game._id)` to `game._id.equals(upload.game)` in `build.service.js` and `game.service.js`, and the `review` check in `review.service.js`, because ids now arrive as strings.

- [ ] **Step 6: Add Media to the harness**

Add `['/api/uploads', 'media']` to `ROUTES`, set `MEDIA_URL`, and update the `Upload` import paths. Tests that set `env.aws` for uploads import Media's `env`.

- [ ] **Step 7: Run all checks, as in Task 1 Step 8**

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Extract media service"
```

## Task 5: Extract Identity and introduce Member

**Files:**

- Create: `services/identity/package.json`, `src/{app,server}.js`, `src/config/env.js`, `src/middleware/auth.js`, `src/modules/accounts/{user.model,access.routes,community.client}.js`, `src/seed.js`, `scripts/seed.js`
- Move: `services/community/src/modules/auth/` to `services/identity/src/modules/auth/`
- Rename: `services/community/src/modules/users/user.model.js` to `member.model.js`
- Create: `shared/src/seed.js`, `services/stack-tests/test/identity.test.js`
- Modify: Community's `middleware/auth.js`, `routes.js`, `seed.js`, `scripts/seed.js`, `modules/internal/service.routes.js`, `modules/admin/admin.service.js`, and every `ref: 'User'` and `User.` use in Community
- Test: changes to `stack.js`, `helpers.js`, `seed.test.js`, `auth.test.js`, and the `User` reads in `community`, `feedback`, `platform` and `reviewer-of-the-month`

**Interfaces:**

- Consumes: `createAuth`, `internalClient`, `setSessionCookie`
- Produces in Identity:
  - `User` model with `username`, `email`, `passwordHash`, `role`, `status`, `suspension`
  - `GET /internal/accounts/:id/access`, moved from Community
  - `PUT /internal/accounts/:id/access`, with body `{ role, status, suspension }`, where `suspension: null` unsets it
  - `memberFor(user): Promise<Me>`, which calls `PUT /internal/members/:id` with `{ username, email, role }`
- Produces in Community:
  - `Member` model, with `User`'s fields minus `passwordHash`
  - `PUT /internal/members/:id`, an upsert with `$setOnInsert` that sets `displayName` to the username and returns `toMe(member)`
- Produces from `@playloop/shared`: `SEED_ACCOUNTS`, the three seed accounts plus `seed_admin`
- Produces in `helpers.js`: `createUser(overrides)` writes a `User` and a `Member` with the same `_id`. Account fields go to both, and profile fields only to `Member`. It returns the `Member`.

- [ ] **Step 1: Write the failing tests in `identity.test.js`**

Test names and assertions:

- `can retry registration after a 503` (Review Focus 1): inside `withServiceDown('community', ...)`, register gets 503 and `User.countDocuments()` is 0. Outside it, the same body gets 201 with one `User` and one `Member`.
- `repairs a missing Member at login`: delete the `Member`, log in, then status 200 and the `Member` exists
- `answers 401 for a session with no Member` (Review Focus 3): delete the `Member`, then `GET /api/me` with the old cookie is 401
- `treats a session with no Member as a guest on public routes`: the same cookie on `GET /api/games` is 200
- `leaves everything unchanged when Identity is down during a ban`: inside `withServiceDown('identity', ...)`, the admin gets 503, `Member.status` stays `active`, and no `ModerationAction` exists
- `applies a ban to every service`: after the admin ban, `GET /api/me`, `GET /api/me/notifications` and `POST /api/uploads` are all 403 with `Your account has been banned`
- `lifts a suspension by date on every service`: with `status: 'suspended'` and a past `until` on the `User` and `Member`, `GET /api/me/notifications` is 200
- `rejects an unsigned call to the access route`: `GET /internal/accounts/:id/access` with no signature on the Identity app is 401

- [ ] **Step 2: Run them and confirm they fail on the missing Identity app**

Run: `npm test -w @playloop/stack-tests -- test/identity.test.js`
Expected: FAIL.

- [ ] **Step 3: Rename the model in Community**

Rename `User` to `Member` across `services/community/src`, with `ref: 'Member'` on every model and `mongoose.model('Member', memberSchema)`. Remove `passwordHash`. Switch `helpers.js` and the test reads listed above to `Member`.

- [ ] **Step 4: Build the Identity service**

The controller's register calls `memberFor(user)` and, on failure, runs `user.deleteOne()` and rethrows. Login calls `memberFor(user)`. Remove `/auth` from Community's routes. Delete Community's temporary access route. Remove the `toMe` import from the moved controller.

- [ ] **Step 5: Add the two Community routes and the admin writes**

Add `PUT /internal/members/:id`. In `suspendUser`, `unsuspendUser` and `setRole`, call `identity.put('/internal/accounts/:id/access', ...)` after the existing checks and before any local write.

- [ ] **Step 6: Split the seed**

`SEED_ACCOUNTS` in `shared/src/seed.js` holds ids, usernames, emails and roles, including `seed_admin` with role `admin`. `seedAccounts(password)` in Identity creates `User` rows and returns `{ createdUsers }`. `seedCommunity()` in Community creates `Member` rows and games and returns `{ createdMembers, createdGames }`. Update `seed.test.js` for four accounts and call both functions. Keep the check that refuses to reuse an existing email in `seedAccounts`.

- [ ] **Step 7: Add Identity to the harness**

Add `['/api/auth', 'identity']` to `ROUTES`, and point `IDENTITY_URL` at the Identity server. Update `auth.test.js` imports.

- [ ] **Step 8: Add the cross-service import rule**

In `eslint.config.js`, for each of the four service folders, add `no-restricted-imports` patterns that block `../**/identity/**`, `../**/community/**`, `../**/notifications/**` and `../**/media/**`, leaving out the service's own name. `services/stack-tests` is exempt.

- [ ] **Step 9: Run all checks, as in Task 1 Step 8**

Expected: all pass. Confirm the lint rule works by adding a cross-service import to one file, seeing `npm run lint` fail, and removing it.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Extract identity service and add community members"
```

## Task 6: Add the gateway, Compose stack, smoke test and CI

Docker Desktop must be running for this task.

**Files:**

- Create: `services/gateway/{Dockerfile,nginx.conf}`, `services/Dockerfile`, `.env.example`, `services/stack-tests/smoke.js`
- Delete: `services/community/Dockerfile`, `services/community/.env.example`
- Modify: `docker-compose.yml`, root `package.json`, `.dockerignore`, `.github/workflows/ci.yml`, `README.md`, and `config/s3.js` plus the `getSignedUrl` calls in Community and Media

**Interfaces:**

- Consumes: the services from Tasks 1 to 5, and `seed_admin`
- Produces: `npm run dev` (`docker compose up --build`), `npm run seed`, `npm run smoke`. `smoke.js` reads `GATEWAY_URL` and `SEED_PASSWORD`, and `SMOKE_REMOTE=1` skips its last two steps.
- Produces in Community and Media: `s3Presign`, an `S3Client` using `S3_PUBLIC_ENDPOINT` when set, otherwise the same settings as `s3`. Inside Compose, `S3_ENDPOINT` is `http://storage:9000`, which a browser can't reach, so presigned URLs use `http://localhost:9000`.

- [ ] **Step 1: Write `smoke.js` as the failing test**

Using `fetch` and `assert`, against the gateway:

1. Register two users and keep each cookie.
2. The first user creates and publishes a web game, using the payloads in `games.test.js`.
3. The second user completes and submits a review, using the payloads in `reviews.test.js`.
4. The first user votes on the review, and polls `GET /api/me/notifications` for up to 10 seconds until the notification appears.
5. Log in as `seed_admin` and ban the second user.
6. For the second user, assert 403 on `GET /api/me`, `GET /api/me/notifications` and `POST /api/uploads`.
7. Review Focus 5: using `node:http` so the path isn't normalised, assert 404 on `/internal/accounts/x/access`, `/api/../internal/accounts/x/access` and `/api/%2e%2e/internal/accounts/x/access`.
8. Review Focus 4: run `docker compose restart community`, then poll `GET /api/games` for up to 30 seconds until it returns 200.

- [ ] **Step 2: Run it and confirm it fails with connection refused**

Run: `GATEWAY_URL=http://localhost:4000 npm run smoke`
Expected: FAIL, because nothing is listening.

- [ ] **Step 3: Write `services/gateway/nginx.conf`**

Set `resolver 127.0.0.11 valid=10s` and use a variable in each `proxy_pass`, so Nginx looks up the container IP again after a restart. Set `client_max_body_size 2m`. Forward `X-Forwarded-For` with `$proxy_add_x_forwarded_for`, and overwrite `X-Request-Id` with `$request_id`. Add locations for `/api/auth/`, `/api/me/notifications`, `/api/uploads` and `/api/`. `location /` returns 404 with `{"code":"NOT_FOUND","message":"Not found"}`. Map upstream 502, 503 and 504 to a 503 JSON body with code `SERVICE_UNAVAILABLE` and the message `This service is unavailable, please try again`.

- [ ] **Step 4: Write `services/Dockerfile`**

Base it on the old Dockerfile, with `ARG SERVICE`, `ENV SERVICE=$SERVICE`, `npm ci --omit=dev --workspace @playloop/$SERVICE`, and a `COPY` for every workspace `package.json`. End with `CMD exec node services/$SERVICE/src/server.js`, because without `exec` the shell stays as PID 1 and SIGTERM never reaches Node. The health check uses `$PORT`.

- [ ] **Step 5: Extend `docker-compose.yml`**

Add the four services and the gateway. Only the gateway publishes a port (`4000:80`) among these five. Each service uses `mongodb://mongo:27017/<database>?directConnection=true`, because the replica set advertises `localhost`. Set `NODE_ENV=development`, secrets with local defaults such as `${JWT_SECRET:-dev-jwt-secret}`, and `*_URL` values such as `http://community:4002`. Pass S3 settings to Community and Media. The gateway depends on the four services being healthy.

- [ ] **Step 6: Add `s3Presign` and the root scripts**

Use `s3Presign` in every `getSignedUrl` call in Community and Media. Add root scripts `dev`, `seed` (two `docker compose run --rm` commands, Identity first, passing `SEED_PASSWORD`) and `smoke`.

- [ ] **Step 7: Run the stack and the smoke test**

Run: `npm run dev`, then in another terminal `SEED_PASSWORD=Smoke-test-password-123 npm run seed && SEED_PASSWORD=Smoke-test-password-123 GATEWAY_URL=http://localhost:4000 npm run smoke`
Expected: exit code 0.

- [ ] **Step 8: Update CI and the README**

The `docker` job builds every image. A new `smoke` job runs `docker compose up -d --build --wait gateway`, then the seed and smoke commands above. Replace the README's local setup steps with `npm run dev` and `npm run seed`.

- [ ] **Step 9: Run all checks, as in Task 1 Step 8**

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add gateway, compose stack and smoke test"
```

## Task 7: Add production Compose and the runbook

Steps 1 to 4 can run now. Step 5 waits for the Learner Lab Readme.

**Files:**

- Create: `docker-compose.prod.yml`
- Modify: `infra/template.yaml`, `infra/README.md`, `.env.example`

**Interfaces:**

- Consumes: `services/Dockerfile`, `services/gateway`, the `ApiUrl` template parameter
- Produces: template parameter `ApiOriginDns`, resource `ApiDistribution`, and output `ApiCdnUrl`

- [ ] **Step 1: Write `docker-compose.prod.yml`**

Add the gateway and four services, with no `mongo`, `storage` or `storage-init`. Set `NODE_ENV=production`, `restart: unless-stopped`, and `TRUST_PROXY_HOPS=3` (Amplify, CloudFront, Nginx). Use `${VAR:?}` for secrets and the four `MONGODB_URI` values, so a missing value stops startup. Publish `80:80`. Use the `awslogs` driver with one group per service and `awslogs-create-group: 'true'`.

- [ ] **Step 2: Validate it**

Run: `docker compose -f docker-compose.prod.yml --env-file .env.example config --quiet`
Expected: exit code 0.

- [ ] **Step 3: Add `ApiDistribution` to `infra/template.yaml`**

Add a CloudFront distribution with `ApiOriginDns` as a custom origin over HTTP on port 80, all HTTP methods allowed, the managed `CachingDisabled` policy (`4135ea2d-6df8-44a3-9df3-4b5a84be39ad`) and the managed `AllViewer` origin request policy (`216adef6-5c7f-47e4-b989-5492eafa07d3`). Check both ids against the AWS documentation before saving.

- [ ] **Step 4: Rewrite the App Runner section of `infra/README.md` and commit**

Cover these steps in order:

1. Launch one `t3.small` with `LabInstanceProfile` and the metadata hop limit set to 2.
2. Allow port 80 from the `com.amazonaws.global.cloudfront.origin-facing` prefix list only.
3. Install Docker and Compose.
4. Clone the repo and create `.env`.
5. Run `docker compose -f docker-compose.prod.yml up -d --build`.
6. Deploy the SAM stack with `ApiOriginDns`, set `ApiUrl` to `ApiCdnUrl`, and point the Amplify rewrite at the same address.

Add the four database names, and move the known limit about `req.ip` to the new path.

```bash
git add -A
git commit -m "Add production compose and EC2 runbook"
```

- [ ] **Step 5: Deploy, once the Learner Lab Readme is in**

Change the region, IAM roles and any blocked services to match the Readme, then follow the runbook. The seed refuses to run in production, so run both seed commands once with `-e NODE_ENV=development` on the `docker compose run` line, using a strong `SEED_PASSWORD`. This creates the demo data and `seed_admin`. Then run the smoke test against the deployed URL with `SMOKE_REMOTE=1`. Its last two steps stay local, because one needs `docker compose` and the prefix list covers the other.
