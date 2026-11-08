# Deploy PlayLoop: EC2 + Amplify + Atlas + S3 + CloudWatch

The `main` branch runs the backend on one Linux EC2 instance. The `frontend`
branch contains the React/Vite app deployed by Amplify. No branch merge or
App Runner service is required. The client on `main` is only a workspace placeholder.

```text
Browser -> Amplify /api/* rewrite -> HTTPS Caddy -> Nginx gateway
                                                 -> Identity :4001
                                                 -> Community :4002
                                                 -> Notifications :4003
                                                 -> Media :4004
Node services -> Atlas (four databases on one cluster)
Browser -> presigned S3 uploads; CloudFront -> private media/play buckets
Community -> build-unzip Lambda -> HTTPS gateway /api/internal/... callbacks
EventBridge -> monthly-badges Lambda -> HTTPS gateway /api/internal/...
Docker -> CloudWatch Logs (optional Compose override)
```

## 1. Prerequisites

- AWS region `ap-southeast-1`, AWS CLI v2, SAM CLI and Node.js 22+ on the deployment workstation.
- `esbuild` on PATH for `sam build` (`npm install -g esbuild`).
- Linux EC2 with Docker Engine and Docker Compose v2.24.4+ installed. Enable Docker
  at boot: `sudo systemctl enable --now docker`.
- An Elastic IP and an API hostname, such as `api.example.com`, with its DNS A
  record pointing to that IP. Remove any AAAA record unless IPv6 is configured.
- Public subnet, internet gateway and outbound internet access for Atlas,
  AWS APIs, image downloads and certificate issuance.
- Security group inbound TCP 80 and 443; SSH 22 only from your IP if using SSH.
  Do not expose 4000-4004, 27017 or 9000-9001. Session Manager is an alternative to SSH.
- Start with sufficient memory for four Node processes plus image builds, then
  size using measurements. This is a single-instance deployment with downtime
  during some updates, not a highly available deployment.

Caddy obtains and renews HTTPS certificates automatically. Keep its named volumes
and public ports 80/443 available. Elastic IPs, compute, storage, logs and network
traffic have charges; configure an AWS Budget alert before provisioning.

## 2. Atlas

Create an Atlas Free/M0 cluster and a database user with read/write access to:
`playloop_identity`, `playloop_community`, `playloop_notifications`, `playloop_media`.
Each service gets its own URI pointing to the corresponding database. URL-encode
the username/password in each URI. Do not copy the local `directConnection=true`.

Allow the EC2 Elastic IP as `/32` in Atlas Network Access. Add a workstation IP
only when needed for administration. M0 has limited capacity and no managed
backups; it does not satisfy a production requirement for daily managed backups.

## 3. Storage, CDN, Lambdas and log group

Before deploying, store a random webhook secret of at least 32 characters in an
existing Secrets Manager secret in the stack's account and region. Use a dedicated
**plaintext SecretString** (not JSON or the EC2 configuration file), encrypted with
the default AWS managed `aws/secretsmanager` key. Set the API's
`INTERNAL_WEBHOOK_SECRET` to the exact same value. Use a secure secret-entry workflow;
never put the value in shell arguments, SAM configuration, logs or Git.

From `infra/` on the workstation, run (examples here use Bash):

```bash
sam build
sam deploy --config-env dev --parameter-overrides \
  Env=dev \
  ClientOrigins=http://localhost:5173 \
  ApiUrl=https://api.example.com \
  InternalWebhookSecretArn=YOUR_EXISTING_WEBHOOK_SECRET_FULL_ARN
aws cloudformation describe-stacks --stack-name playloop-dev \
  --region ap-southeast-1 --query 'Stacks[0].Outputs' --output table
```

`ApiUrl` is the public HTTPS gateway base URL, with no `/api` suffix. The API may
not be live yet; callbacks will work after EC2 starts. `InternalWebhookSecretArn`
replaces the old value parameter `InternalWebhookSecret`; remove the old override
from any saved SAM configuration. Only the full ARN enters Lambda environment
variables. Each invocation reads `AWSCURRENT` using `GetSecretValue`, retaining the
value only in memory for that invocation. Each Lambda role can read only that ARN;
it cannot list, create or update secrets. The stack does not create the secret.
Customer-managed KMS keys require an explicit, key-scoped `kms:Decrypt` policy and
key-policy access; this template grants neither and uses the default key workflow.
The Node.js Lambda runtime provides the AWS SDK for the esbuild function's existing
`@aws-sdk/*` external setting; SAM packages the monthly function's dependency.

Validate locally before deployment with `sam validate --lint --template-file template.yaml`.

| Output               | EC2 environment/configuration                      |
| -------------------- | -------------------------------------------------- |
| MediaBucket          | S3_MEDIA_BUCKET                                    |
| BuildsBucket         | S3_BUILDS_BUCKET                                   |
| PlayBucket           | S3_PLAY_BUCKET                                     |
| MediaCdnUrl          | MEDIA_CDN_URL                                      |
| PlayCdnUrl           | PLAY_CDN_URL                                       |
| BuildUnzipFunction   | BUILD_UNZIP_FUNCTION                               |
| ApiAccessPolicyArn   | Attach to EC2 instance role                        |
| BackendLogGroup      | CLOUDWATCH_LOG_GROUP                               |
| BackendLogsPolicyArn | Attach to EC2 instance role for CloudWatch logging |

Buckets stay private. CloudFront serves media and playable builds through origin
access controls, on separate domains from the frontend. The build-unzip Lambda
extracts uploaded ZIPs into the play bucket and reports status through
`/api/internal/builds/{buildId}/status`. Monthly badges use
`/api/internal/badges/monthly`. Both routes require the webhook signature.
The gateway deliberately blocks the separate service-to-service `/internal` routes.

## 4. EC2 IAM instance profile and metadata

Create a role trusted by `ec2.amazonaws.com`, put it in an instance profile and
attach it to EC2. Attach the stack's `ApiAccessPolicyArn` and, when using the
CloudWatch override, `BackendLogsPolicyArn`. Optionally attach
`AmazonSSMManagedInstanceCore` for Session Manager, with SSM Agent installed.

For Secrets Manager retrieval, add `secretsmanager:GetSecretValue` scoped to
the configuration secret ARN. A customer-managed encryption key also needs
appropriate `kms:Decrypt` permission. Do not attach an App Runner trust policy.

Require IMDSv2 and set the metadata response hop limit to 2 so AWS SDKs inside
Docker can retrieve temporary instance-role credentials:

```bash
aws ec2 modify-instance-metadata-options --region ap-southeast-1 \
  --instance-id YOUR_INSTANCE_ID --http-endpoint enabled \
  --http-tokens required --http-put-response-hop-limit 2
```

This single-host setup gives its containers access to the same instance role.
Do not set AWS access keys, `S3_ENDPOINT` or `S3_PUBLIC_ENDPOINT` in production.

## 5. Configure and start EC2

Clone `main` to `/opt/playloop` on EC2 (use a deploy key or your normal private
repository access method). All commands below run from that directory.

Fill in `.env.ec2.example` using the SAM outputs and Atlas URIs. Use different,
random values for `JWT_SECRET` and `INTERNAL_SERVICE_SECRET`, shared across all
four services. `INTERNAL_WEBHOOK_SECRET` must match the plaintext value in the
dedicated webhook secret referenced by SAM's `InternalWebhookSecretArn`.
Use the exact frontend HTTPS origin without a trailing slash for `CLIENT_ORIGIN`.

Store the filled file contents as a **plaintext** Secrets Manager secret, for
example `playloop/dev/ec2-env` (not the key/value JSON format). Retrieve it on EC2
using AWS CLI v2 and the instance role:

```bash
cd /opt/playloop
umask 077
aws secretsmanager get-secret-value --region ap-southeast-1 \
  --secret-id playloop/dev/ec2-env --query SecretString --output text \
  > .env.ec2.pending && mv .env.ec2.pending .env.ec2
chmod 600 .env.ec2
```

The filled file stays on EC2 as a protected runtime configuration, ignored by Git
and excluded from Docker build contexts. Do not paste it into logs. Single-quote
URIs/secrets as shown in the example to prevent Compose dollar interpolation.
Secret rotation requires updating both the dedicated webhook secret and the EC2
configuration secret, fetching the file again and recreating the containers.
Lambdas read the current version on each invocation without redeployment. Coordinate
rotation with API container replacement and allow in-flight invocations to finish;
the signature protocol accepts one key at a time.

Validate without printing the resolved secrets, then start:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml config --quiet
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build --wait
curl --fail https://api.example.com/api/health
```

This standalone file runs six containers: Caddy, Nginx and four Node services.
It does not start local MongoDB or S3 emulation, and publishes only 80/443.
**Do not combine it with the development `docker-compose.yml`.** The existing
Dockerfiles build directly on EC2; ECR is optional. Restart policies restore
started containers after Docker/EC2 restarts. Do not use `down -v`: Caddy's
certificate state lives in named volumes.

For CloudWatch, use both files consistently for deployment and management:

```bash
docker compose --env-file .env.ec2 \
  -f docker-compose.ec2.yml -f docker-compose.cloudwatch.yml config --quiet
docker compose --env-file .env.ec2 \
  -f docker-compose.ec2.yml -f docker-compose.cloudwatch.yml up -d --build --wait
```

The log group must already exist and its policy must be on the EC2 role. Docker's
logging driver uses the host instance profile. Logs have 14-day retention.
Non-blocking buffers prioritize availability; logs can be dropped if buffers fill
during an outage. Without the override, local logs rotate at 10 MB x 3 per container.

## 6. Amplify frontend

Connect the GitHub repository and select branch `frontend`. Configure a root
repository build using this specification (not a `client`-only dependency install):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm install 22
        - nvm use 22
        - npm ci
    build:
      commands:
        - npm run build -w @playloop/client
  artifacts:
    baseDirectory: client/dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

Set `VITE_API_BASE_URL=/api` and `VITE_API_MOCKING=off`. Add these rewrite rules,
with the API proxy before the SPA fallback:

```json
[
  {
    "source": "/api/<*>",
    "target": "https://api.example.com/api/<*>",
    "status": "200"
  },
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
    "target": "/index.html",
    "status": "200"
  }
]
```

The current cookie is Secure in production and SameSite=Lax. Keep browser API
requests on the frontend origin through `/api`, and test that Amplify forwards
`Set-Cookie` and subsequent authenticated requests correctly.

Once Amplify gives you its final URL, update `CLIENT_ORIGIN` in the configuration
secret, fetch it again and recreate the EC2 services. Also redeploy SAM with
`ClientOrigins=https://frontend.YOUR_APP_ID.amplifyapp.com`, the same `ApiUrl`,
`Env` and `InternalWebhookSecretArn`. This updates S3 CORS for direct browser uploads.

## 7. Verify, update and troubleshoot

- Check `https://<amplify-host>/api/health` and the direct API health URL.
- Register, log in, refresh, and check that the `playloop_token` cookie persists.
- Upload an image and a ZIP web build; confirm processing becomes ready and the
  game plays from CloudFront. Check Lambda logs if the build stays processing.
- Test notifications, reviews and direct navigation to nested frontend pages.
- Verify logs in `/playloop/dev/backend` and the Lambda log groups.
- Reboot EC2 once and verify HTTPS, authentication and uploads recover.
- Add CloudWatch alarms for EC2 status checks and Lambda errors, plus budget alerts.

For an update, commit/push the backend changes first, then on EC2:

```bash
cd /opt/playloop
git pull --ff-only origin main
docker compose --env-file .env.ec2 \
  -f docker-compose.ec2.yml -f docker-compose.cloudwatch.yml up -d --build --wait
curl --fail https://api.example.com/api/health
```

Omit the CloudWatch file if you chose local logging. Frontend pushes to `frontend`
are deployed independently by Amplify. Recreate containers after any environment
change; `docker compose restart` alone does not load new environment variables.

Use `docker compose ... ps` and `docker compose ... logs --tail 100` to diagnose
startup issues (include the same env/Compose flags). `--wait` checks the Node and
gateway health checks, but the public `curl` is also required to verify certificates.
Docker restart policies recover exited processes; an unhealthy-but-running
container is not automatically restarted, so monitor health and status checks.

Rate limits are in memory per service process. Caddy discards untrusted forwarded
client headers; the services trust the two private proxy hops (Caddy and Nginx).
Behind Amplify, rate limiting may see a CDN address rather than a visitor address;
verify this before relying on per-visitor limits. Threaded game exports requiring
cross-origin isolation need additional hosting configuration. Deleted/replaced
builds are not automatically removed from S3.

## References

- [EC2 container metadata hop limit](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-options.html)
- [Docker CloudWatch logging and IAM](https://docs.docker.com/engine/logging/drivers/awslogs/)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Amplify rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html)
- [Atlas free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
