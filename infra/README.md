# Deploying PlayLoop to AWS

Do the steps in this order: some values only exist after an earlier step. Repeat everything with `prod` instead of `dev` for production.

## 0. Tools

- AWS CLI v2, logged in (`aws configure`), region `ap-southeast-1`
- AWS SAM CLI
- Docker

## 1. MongoDB Atlas

1. Create a cluster and a database user. Production needs a tier with daily backups (NFR-010); the free M0 tier has none.
2. Network access: allow `0.0.0.0/0` (App Runner has no fixed outbound IP without a VPC connector).
3. Connection string, with the database name: `mongodb+srv://…/playloop-dev?retryWrites=true` → `MONGODB_URI`.

## 2. Storage, CDN and the Lambdas (SAM)

Run from `infra/`. The first deploy uses placeholders for the URLs that don't exist yet.

```bash
cd infra
sam build
sam deploy --config-env dev --parameter-overrides Env=dev ClientOrigins=http://localhost:5173 ApiUrl=https://example.invalid InternalWebhookSecret=$(openssl rand -hex 32)
```

Keep the generated secret: the API needs the same value. The stack outputs give you:

| Output               | API environment variable               |
| -------------------- | -------------------------------------- |
| `MediaBucket`        | `S3_MEDIA_BUCKET`                      |
| `BuildsBucket`       | `S3_BUILDS_BUCKET`                     |
| `PlayBucket`         | `S3_PLAY_BUCKET`                       |
| `MediaCdnUrl`        | `MEDIA_CDN_URL`                        |
| `PlayCdnUrl`         | `PLAY_CDN_URL`                         |
| `BuildUnzipFunction` | `BUILD_UNZIP_FUNCTION`                 |
| `ApiAccessPolicyArn` | attach to the App Runner instance role |

## 3. API on App Runner (console)

1. Push the image (App Runner runs x86, so build for `linux/amd64`):

   ```bash
   aws ecr create-repository --repository-name playloop-api
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.ap-southeast-1.amazonaws.com
   docker buildx build --platform linux/amd64 -f server/Dockerfile -t <account>.dkr.ecr.ap-southeast-1.amazonaws.com/playloop-api:dev --push .
   ```

2. Create an IAM role trusted by `tasks.apprunner.amazonaws.com` and attach `ApiAccessPolicyArn`.
3. Create the App Runner service from the ECR image: port `8080`, health check HTTP `/api/health`, instance role from step 2.
4. Environment variables: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `CLIENT_ORIGIN`, `AWS_REGION=ap-southeast-1`, and the stack outputs above. Put `MONGODB_URI`, `JWT_SECRET` and `INTERNAL_WEBHOOK_SECRET` in Secrets Manager and reference them (NFR-005). Do **not** set `S3_ENDPOINT` or AWS keys: the instance role provides access.
5. Redeploy the stack with the real API URL:

   ```bash
   sam deploy --config-env dev --parameter-overrides Env=dev ClientOrigins=http://localhost:5173 ApiUrl=https://<service>.ap-southeast-1.awsapprunner.com InternalWebhookSecret=<same secret>
   ```

## 4. Frontend on Amplify (console)

1. Connect the GitHub repo, app root `client`. Branch `develop` → dev, `main` → prod.
2. Rewrites and redirects (JSON), so the browser talks to the API on the same origin:

   ```json
   [
     {
       "source": "/api/<*>",
       "target": "https://<service>.ap-southeast-1.awsapprunner.com/api/<*>",
       "status": "200"
     },
     {
       "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
       "target": "/index.html",
       "status": "200"
     }
   ]
   ```

3. Set `CLIENT_ORIGIN` on App Runner to the Amplify URL, and redeploy the stack with `ClientOrigins=https://<branch>.<app>.amplifyapp.com` so browsers can upload straight to S3.

## 5. Smoke test

```bash
curl https://<amplify-url>/api/health
curl -i -X POST https://<amplify-url>/api/auth/login -H "Content-Type: application/json" -d '{"email":"…","password":"…"}'
```

The login response **must** include a `Set-Cookie: playloop_token=…` header. If it doesn't, Amplify is dropping the cookie and login won't work. Then publish a game with a web build zip and check its status turns `ready` and it plays.

## How web builds are processed

1. The browser uploads the zip to the builds bucket (`POST /api/uploads` → PUT → `/complete`).
2. `POST /api/games/{gameId}/builds` creates the build as `processing` and invokes the Lambda asynchronously with the build id.
3. The Lambda unzips into the play bucket under `{buildId}/` (max 5,000 files, 2 GB unpacked, no unsafe paths, needs an `index.html`), sets Content-Type and Content-Encoding for Unity `.br`/`.gz` files, then calls `POST /api/internal/builds/{buildId}/status` signed with `INTERNAL_WEBHOOK_SECRET`.
4. The game plays from `PLAY_CDN_URL/{buildId}/…`, a separate domain from the app.

Locally there is no Lambda: leave `BUILD_UNZIP_FUNCTION` empty and web builds stay `processing`.

## How monthly badges are awarded

EventBridge runs the `monthly-badges` Lambda at 00:05 UTC on the 1st, 2nd and 3rd of each month. The Lambda calls `POST /api/internal/badges/monthly` signed with `INTERNAL_WEBHOOK_SECRET`, and the API gives Reviewer of the Month to last month's top reviewer. Each month is awarded once, so the later runs only matter if the first one fails.

To run it on demand:

```bash
aws lambda invoke --function-name playloop-dev-monthly-badges /dev/stdout
```

Locally there is no Lambda, so call the API yourself:

```bash
curl -i -X POST http://localhost:4000/api/internal/badges/monthly -H "X-PlayLoop-Signature: $(printf '' | openssl dgst -sha256 -hmac "$INTERNAL_WEBHOOK_SECRET" -hex | awk '{print $NF}')"
```

## Known limits

- Rate limits are kept in memory per App Runner instance and keyed by IP. Behind Amplify, check that `req.ip` is the visitor's IP, not a CloudFront address.
- Godot 4 exports that use threads need cross-origin isolation, which an iframe can't provide here. Export without threads.
- Deleting or replacing a build doesn't delete its files from S3.
