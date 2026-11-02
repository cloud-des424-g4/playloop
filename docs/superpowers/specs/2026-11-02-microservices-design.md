# PlayLoop microservices design

Date: 2 November 2026
Branch: `feature/microservices`, from `11ad1b2`
Status: waiting for review

## Decisions

The backend is one Express process with 16 modules and one MongoDB database. It will become four Node services behind an Nginx gateway.

| Question          | Decision                                                           |
| ----------------- | ------------------------------------------------------------------ |
| Split             | Identity, Community, Notifications, Media, plus a gateway          |
| Data              | One database per service, with a `Member` user record in Community |
| Service messaging | Signed HTTP, with an outbox that retries notification delivery     |
| Hosting           | Docker Compose on one EC2 instance                                 |

The `users` module goes to Community, not Identity. Profile pages are built from game and review stats, genre config, reputation and badges, and all of that lives in Community. Identity keeps login and account data only.

## What done means

1. Each service has its own Docker image and its own database.
2. Every public route in `docs/api` behaves as it does today, on the same host and with the same cookie. The `frontend` branch needs no changes: it calls `/api`, and its dev proxy points at `localhost:4000`.
3. The 118 server tests and the Lambda tests pass with the services talking over real HTTP.
4. A Compose smoke test passes through Nginx.
5. The stack runs on one EC2 instance before the 17 November presentation.

## Services

| Service       | Port | Database                 | Owns                                                                                                                                              | Public routes            |
| ------------- | ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Gateway       | 80   | none                     | Nginx routing                                                                                                                                     | All of `/api/`           |
| Identity      | 4001 | `playloop_identity`      | `User`, `PasswordReset`                                                                                                                           | `/api/auth/*`            |
| Community     | 4002 | `playloop_community`     | `Member`, `Game`, `Featured`, `Build`, `Review`, `Reply`, `Reaction`, `Vote`, `ReputationEvent`, `Report`, `ModerationAction`, `Config`, `Outbox` | Everything else          |
| Notifications | 4003 | `playloop_notifications` | `Notification`                                                                                                                                    | `/api/me/notifications*` |
| Media         | 4004 | `playloop_media`         | `Upload`                                                                                                                                          | `/api/uploads*`          |

Community keeps the modules that write to each other in transactions: admin, builds, discussions, games, health, internal, meta, reports, reputation, reviews, roulette, users and votes.

## Gateway routing

Nginx proxies only `/api/`. Any other path returns 404, so the `/internal/*` routes between services can't be reached from outside.

| Path                    | Service       |
| ----------------------- | ------------- |
| `/api/auth/`            | Identity      |
| `/api/me/notifications` | Notifications |
| `/api/uploads`          | Media         |
| `/api/`                 | Community     |

The last row covers `/api/health`, `/api/docs` and the Lambda callbacks under `/api/internal/`.

## Data ownership

Identity's `User` keeps `username`, `email`, `passwordHash`, `role`, `status` and `suspension`. Its profile, reputation and badge fields move out.

Community's `Member` uses the same `_id` as the `User`. Stored ids keep their values and `ref: 'User'` becomes `ref: 'Member'`, so the populate calls and the vote and review transactions keep working inside Community.

| `Member` fields                                                                                                     | Owner     | How they change                                                            |
| ------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------- |
| `displayName`, `pronouns`, `bio`, `avatarKey`, `favoriteGenres`, `platforms`, `links`, `reputationPoints`, `badges` | Community | Written directly                                                           |
| `username`, `email`                                                                                                 | Identity  | Copied at registration. They never change: `UpdateMeInput` rejects them    |
| `role`, `status`, `suspension`                                                                                      | Identity  | Community updates its copy in the same admin request that updates Identity |

Notifications and Media store user, game and review ids with no `ref`. Nothing is deployed yet, so there is no data migration. Local databases are reseeded.

## Calls between services

| Service       | Route                                 | Caller               | Purpose                                                                |
| ------------- | ------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| Identity      | `GET /internal/accounts/:id/access`   | Notifications, Media | Read `role`, `status` and `suspension`                                 |
| Identity      | `PUT /internal/accounts/:id/access`   | Community            | Set them from an admin action                                          |
| Community     | `PUT /internal/members/:id`           | Identity             | Create the `Member` if it's missing, and return the `Me` response body |
| Community     | `POST /internal/refs`                 | Notifications        | Return user summaries and game details for a list of ids               |
| Community     | `POST /internal/upload-targets/check` | Media                | Confirm the user owns the game, or the in-progress review              |
| Media         | `POST /internal/uploads/take`         | Community            | Return a completed upload, or the existing 400 error                   |
| Media         | `POST /internal/uploads/game-media`   | Community            | Return the completed game media uploads for a list of ids              |
| Notifications | `POST /internal/notifications`        | Community outbox     | Store a notification, using the outbox row id as `_id`                 |

Rules for every call:

- The body, method, path and a timestamp are signed with HMAC-SHA256 using `INTERNAL_SERVICE_SECRET`. A service rejects a signature that is wrong or more than 60 seconds old.
- Calls time out after 3 seconds.
- A 4xx JSON error from the other service reaches the browser unchanged.
- A network error, a timeout or a 5xx becomes a new 503 error with the code `SERVICE_UNAVAILABLE`. This code is added to the `Error` schema, and the response validator skips 5xx bodies.

The signing above is separate from the Lambda callbacks, which keep their body-only signature and `INTERNAL_WEBHOOK_SECRET`.

Two pieces of upload code avoid a network call. `UPLOAD_RULES` moves to `@playloop/shared`, so `/api/meta` reads it locally. `proofUrl` moves to Community, which already signs S3 URLs for build downloads.

## Main flows

**Register.** Identity validates the input and creates the `User`, then calls `PUT /internal/members/:id`. If that fails, Identity deletes the `User` and returns 503, so the person can try again with the same username. On success it sets the cookie and returns 201 with the `Me` body.

**Login.** Identity checks the password and the account block, then makes the same `PUT` call. The call is idempotent, so it also repairs a `User` that has no `Member`.

**Admin suspend, ban, lift or role change.** Community applies the existing rules, then calls `PUT /internal/accounts/:id/access`. If that fails, the admin gets a 503 and nothing has changed. Community then updates the `Member` and writes the `ModerationAction`. If this second write fails, the admin repeats the action, and the Identity call does no harm the second time. A ban applies to every service as soon as the Identity call succeeds.

**Notifications.** `notify(input, session)` keeps its signature but writes an `Outbox` row in the caller's transaction. A loop in Community runs every second and delivers up to 50 rows, oldest first. A delivered row is deleted. A failed row waits `min(2^attempts, 300)` seconds and stays until it is delivered. Using the row id as the notification `_id` means a repeated delivery can't create a duplicate. The loop stops on SIGTERM.

**Notification list.** Notifications reads its own rows, then calls `POST /internal/refs` for the `actor` and `game` details. If Community is down, the list still returns, without those two fields. The API already treats both as optional.

**Uploads.** When an upload names a game or review, Media calls `POST /internal/upload-targets/check` first. When a game, build, review or avatar uses a finished upload, Community calls `POST /internal/uploads/take`.

**Monthly badges and web builds.** These don't change. The Lambdas call `/api/internal/*`, and the gateway sends those to Community.

## Authentication

The cookie name, JWT and 7-day expiry stay the same. Only Identity signs tokens. Every service verifies them with `JWT_SECRET`, then loads the account:

| Service              | Reads the account from                          |
| -------------------- | ----------------------------------------------- |
| Identity             | `User`                                          |
| Community            | `Member`                                        |
| Notifications, Media | `GET /internal/accounts/:id/access` on Identity |

`req.user` stays `{ id, role }`. `accountBlockMessage` compares `suspension.until` with the current time, so an expired suspension stops blocking on every service, even where `status` still says `suspended`.

Accepted risk: with a shared HS256 secret, any compromised service could sign a session token. Asymmetric keys are out of scope.

## Shared code

`services/kit` holds `ApiError`, the logger, error handler, not-found handler, rate limiter, OpenAPI validator, session checks, the signed client and guard, and the server start and shutdown code. It holds no models and no business rules.

Each service loads the same `docs/api/openapi.yaml` for validation. The `/internal` routes are mounted before the validator and aren't in the public spec.

Each service answers `GET /api/health` on its own port for its Docker health check, reporting its own database. The public `/api/health` reaches Community only.

Nginx sets `X-Request-Id`. The kit logs it and forwards it on calls between services, so one browser request can be followed through the logs.

## Repository layout

```text
services/
  kit/            shared infrastructure package
  gateway/        nginx.conf, Dockerfile
  identity/       auth
  community/      admin, builds, discussions, games, health, internal,
                  meta, reports, reputation, reviews, roulette, users, votes
  notifications/  notifications
  media/          uploads
  stack-tests/    the moved server tests, the harness and the smoke test
shared/           constants, now with UPLOAD_RULES
lambdas/          unchanged
```

`server/` is removed. A lint rule stops a service from importing another service's files.

## Testing

The harness in `services/stack-tests` starts all four services in one process, each on its own port. Calls between services use the real signed client over HTTP. A small dispatcher sends each test request to the right service using the gateway's routing table.

All services share one test database in the harness, because they share one Mongoose connection in that process. The lint rule covers the gap: a service can't reach another service's models, so the shared database can't hide a cross-service read.

Existing tests move with these changes:

- `createUser` writes both a `User` and a `Member`.
- Tests that read notifications first call a helper that flushes the outbox.
- Tests that read a profile field use `Member` instead of `User`.

New tests cover:

- signature checks, including an old timestamp
- 4xx and 503 mapping in the client
- outbox retry timing and duplicate delivery
- rollback when registration can't reach Community
- an admin action when Identity is down
- the notification list when Community is down

The smoke test runs against `docker compose up` through Nginx in CI: register two users, publish a game, submit a review, vote, read the notification, ban a user as `seed_admin`, then confirm the ban on Community, Notifications and Media routes. The seed gains that admin account. `npm run seed` seeds Identity first, then Community.

CI builds every service image.

## Deployment

Locally, `npm run dev` runs `docker compose up --build`. The gateway publishes port 4000, and the service ports stay private to the Compose network.

Production uses `docker-compose.prod.yml` on one `t3.small` EC2 instance:

- The images are built on the instance.
- The four databases sit on the existing Atlas cluster.
- `LabInstanceProfile` gives the containers S3 and Lambda access, with the instance metadata hop limit set to 2.
- Logs go to CloudWatch through the `awslogs` driver.
- A CloudFront distribution in front of the instance provides HTTPS, and Amplify rewrites `/api/*` to it.
- The Lambdas' `ApiUrl` points at the same CloudFront address.
- `TRUST_PROXY_HOPS` tells Express how many proxies sit in front of a service, with a default of 1.

The region, the SAM template's IAM roles and the allowed services all depend on the Learner Lab Readme, so step 6 below can't finish until that arrives. The App Runner steps in `infra/README.md` are replaced.

## Build order

Tests stay green at the end of each step.

1. Create `services/kit`, move `server/` to `services/community`, and move the tests to `services/stack-tests`.
2. Extract Notifications with the outbox and `/internal/refs`.
3. Extract Media.
4. Extract Identity and introduce `Member`.
5. Add the gateway, Dockerfiles, Compose stack, seed, smoke test and CI jobs.
6. Add production Compose and the runbook, then deploy.

## Known limits

- All services share one EC2 instance, so a machine failure stops everything and services can't scale apart once deployed. Each service has its own image, so a later move to ECS doesn't need a code change.
- Community still holds 85% of the module code, because its data is tied together by transactions.
- Register and login need both Identity and Community running.
- Rate limits stay in memory, which works while each service runs one container.
- Moving `server/` will conflict with any unmerged backend branch.
- The report's Figures 3 and 4 and its data management text describe the current backend and will need updating.

## Out of scope

SQS, service discovery, a service mesh, autoscaling, separate repositories, automated deployment, frontend changes and Payments.
