# PlayLoop

Reciprocal playtesting platform for indie game developers.

The API is an Express server. Local MongoDB and file storage run in Docker. The client app is not part of this setup.

## Requirements

- Node.js 22 or newer (`nvm use` reads `.nvmrc`)
- Docker Desktop, running

## Run

From the repo root:

```sh
npm install
copy server\.env.example server\.env
npm run services:up
npm run dev
```

On macOS or Linux, copy the env file with `cp server/.env.example server/.env`.

`services:up` starts MongoDB on port 27017 (replica set `rs0`) and local S3-compatible storage on port 9000, then creates the media, builds, and play buckets. `dev` starts the API with `server/.env` and restarts it when server files change.

| URL                                         | What it is                                                 |
| ------------------------------------------- | ---------------------------------------------------------- |
| http://localhost:4000                       | API                                                        |
| http://localhost:4000/api/docs              | Swagger UI                                                 |
| http://localhost:4000/api/docs/openapi.json | OpenAPI document                                           |
| http://localhost:4000/api/health            | `{ "status": "ok", "db": "connected" }` when MongoDB is up |

Stop the API with Ctrl+C. Stop the containers with:

```sh
npm run services:down
```

Run the server tests with `npm test`.

## Seed demo data (local MongoDB or Atlas)

Set `MONGODB_URI` in `server/.env` to the database you want to seed, then run from the repo root:

```sh
npm run seed
```

This loads `server/.env` and inserts three regular demo accounts, two published sample game listings, and default app configuration if missing. It preserves existing records, passwords, and edits; rerunning does not duplicate seed records. Demo seeding is disabled for `NODE_ENV=production`.

Accounts: `developer@seed.example.com`, `creator@seed.example.com`, and `tester@seed.example.com`. A random password is printed for newly created accounts; save it to log in using the API. Optionally set `SEED_PASSWORD` in `server/.env` (at least 12 characters, at most 72 bytes) before the first run. Rerunning does not reset passwords. No admin accounts are created.

Games contain placeholder URLs (`https://example.com`) and no uploaded images or playable builds. Replace those through the normal game workflow when real assets are available. Reviews are not seeded. The script writes to the database selected by `MONGODB_URI`; include `/playloop` before the connection string's `?` if that is your intended database. Do not commit `.env` or demo passwords.

## View the API docs

Start the API with `npm run dev`, then open http://localhost:4000/api/docs in a browser. That page is Swagger UI: each endpoint can be expanded and tried from there.

The same document as JSON is at http://localhost:4000/api/docs/openapi.json. The source file is `docs/api/openapi.yaml`.

These pages are served only when `NODE_ENV` is not `production`. The example env file sets `development`.

## API

The contract is `docs/api/openapi.yaml`. Request and response bodies are checked against it outside production. Check the spec with `npm run spec:lint`.

- Base path is `/api`. Paths in the docs are relative to that, so `POST /auth/login` is `POST http://localhost:4000/api/auth/login`.
- `POST /api/auth/register` and `POST /api/auth/login` set an httpOnly cookie named `playloop_token` (7 days). Send later requests with credentials. Swagger UI keeps that cookie in the browser. From another client, store the cookie and send it back.
- Login accepts an email or a username in the `email` field. A wrong email, username, or password returns `401`. A banned or suspended account returns `403`.
- Logged-out calls to protected routes return `401`. Doing someone else's action returns `403`.
- Errors are `{ "code", "message", "details?" }`. `details` is only present for `VALIDATION_ERROR`.
- Lists take `page` (from 1) and `limit` (max 50) and return `{ "items", "page", "limit", "total" }`.
- Uploads go to storage, not through the API body: `POST /api/uploads`, PUT the file to the returned URL, then `POST /api/uploads/{uploadId}/complete`.
- Rate limits return `429` with code `RATE_LIMITED`.
- Payments are not in this version.

In PowerShell, call `curl.exe` so the commands below are not handled by `Invoke-WebRequest`.

```sh
curl.exe http://localhost:4000/api/health
curl.exe -c cookies.txt -H "Content-Type: application/json" -d "{\"username\":\"ada\",\"email\":\"ada@example.com\",\"password\":\"password123\",\"acceptTerms\":true}" http://localhost:4000/api/auth/register
curl.exe -b cookies.txt http://localhost:4000/api/me
```

## Deploy to AWS

See [infra/README.md](infra/README.md) for the step-by-step deploy (Atlas, SAM stack, App Runner, Amplify).
