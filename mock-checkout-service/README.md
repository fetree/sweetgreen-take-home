# Checkout Service

A GraphQL checkout API built with NestJS and Apollo Server. Handles menu browsing, cart management, loyalty reward redemption, and order placement — integrating with an external loyalty service.

---

## Prerequisites

- Node.js 20+
- npm 10+
- Docker & Docker Compose (for containerised setup)
- The mock loyalty service running on port 3001 (see below)

---

## Start the Loyalty Service

The loyalty service must be running before starting the checkout service.

```bash
# From the project root
cd mock-loyalty-service-candidate

# Option A — Docker
docker build -t mock-loyalty-service .
docker run -p 3001:3001 mock-loyalty-service

# Option B — Node directly
npm install
node server.js
```

Verify:
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

---

## Option 1: Local Dev Mode

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env` if your Postgres or loyalty service are on different ports:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/checkout_db
LOYALTY_SERVICE_URL=http://localhost:3001
```

### Run (with file watching)

```bash
npm run start:dev
```

### Run (single start)

```bash
npm start
```

The GraphQL playground is available at **http://localhost:3000/graphql**.

---

## Option 2: Docker Compose

Starts Postgres and the checkout service together. The loyalty service should still be running on the host (port 3001).

```bash
docker compose up --build
```

To run in the background:
```bash
docker compose up --build -d
```

To stop:
```bash
docker compose down
```

To wipe the database volume:
```bash
docker compose down -v
```

> **Note:** The loyalty service URL is set to `http://host.docker.internal:3001` inside the container so it can reach the host machine. This works on Docker Desktop (Mac/Windows). On Linux you may need to add `--add-host=host.docker.internal:host-gateway` to the service or use the host's LAN IP.

---

## Tests

```bash
npm test
```

With coverage:
```bash
npm run test:cov
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the checkout service listens on |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `LOYALTY_SERVICE_URL` | `http://localhost:3001` | Base URL of the loyalty service |
