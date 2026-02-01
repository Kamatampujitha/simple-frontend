# Job Portal API (Backend)

Simple Node.js + Express backend using **PostgreSQL** + **Prisma**.

## Prerequisites

- **Node.js**: v18+ (recommended: v20)
- **PostgreSQL**: v13+ (local install) OR Docker Desktop/Rancher Desktop
- **npm** (comes with Node)

## 1) Clone & install

```bash
git clone <THIS_REPO_URL>
cd simple-backend
npm install
```

## 2) Configure environment variables

This repo uses a local `.env` file (it is **ignored by git**).

Create it from the example:

```bash
cp .env.example .env
```

Edit `.env` as needed:

- **`DATABASE_URL`**: Postgres connection string
- **`JWT_SECRET`**: any long random string (required for login/auth)
- **`PORT`**: server port (default `4000`)

## 3) Start PostgreSQL

### Option A — Use local Postgres (recommended if already installed)

Make sure Postgres is running and create a database:

```bash
createdb jobportal_dev
```

Then set `DATABASE_URL` in `.env` (example):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobportal_dev"
```

### Option B — Use Docker

Run Postgres in a container:

```bash
docker run --name jobportal-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=jobportal_dev \
  -p 5432:5432 \
  -d postgres:14
```

Use this `DATABASE_URL` in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobportal_dev"
```

## 4) Sync DB schema (Prisma)

This repo does not include Prisma migration files, so the quickest setup is:

```bash
npx prisma generate
npx prisma db push
```

Optional: open Prisma Studio

```bash
npx prisma studio
```

## 5) Run the API

```bash
npm start
```

API will run at:

- `http://localhost:4000/`
- Health check: `http://localhost:4000/health`

## Key endpoint for homepage tabs

Backend supports role/category filtering for the homepage tabs:

- `GET /jobs?role=frontend|backend|fullstack`

Also accepted:

- `GET /jobs?category=frontend|backend|fullstack`

## Main routes

- **Auth**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- **Jobs**: `GET /jobs`, `GET /jobs/:id`, `POST /jobs` (recruiter), `PUT /jobs/:id` (recruiter), `DELETE /jobs/:id` (recruiter/admin)
- **Applications**: `/applications`
- **Saved Jobs**: `/saved-jobs`
- **Profile**: `/profile`
- **Admin**: `/admin`

## CORS / Frontend

By default, CORS allows:

- `http://localhost:5173`
- `http://localhost:3000`

So you can run a frontend locally and call this API.

## Troubleshooting

- **Port already in use (`EADDRINUSE`)**: change `PORT` in `.env`, or stop the process using port `4000`.
- **Prisma connection errors**: verify Postgres is running and `DATABASE_URL` is correct.

