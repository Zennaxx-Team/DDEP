# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run the server
node app.js
# or
npm start

# Build Docker image (NODE_ENV = dev | uat | prepro | prd)
docker build --build-arg NODE_ENV=dev -t ddep .
docker run -p 8014:80 ddep
```

There is no test suite configured. The `tape` package is listed as a dependency but no test files exist.

## Environment

Copy `.env` and set the following variables:

| Variable | Purpose |
|---|---|
| `DBCONFIG_SERVER_1` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASS` | Redis for BullMQ queues |
| `SITE_URL` | Internal base URL used by cron self-calls (e.g. `http://localhost:8014`) |
| `GIMA_SITE_URL` | CORS origin allowed by Express |
| `EnableGima` | `true` to enforce JWT cookie auth; `false` bypasses it |
| `EnableAlertDebug` | `true` to enable alert debug logging |
| `DATA_SIZE` | Max payload size in bytes for log truncation |
| `DDEP_version` | Version string |

Environment-specific files (`.env.dev`, `.env.uat`, `.env.prepro`, `.env.prd`) are used by Docker; the build arg `NODE_ENV` selects which one is copied to `.env` at image build time.

## Architecture Overview

DDEP is a data-integration middleware platform. It ingests data from external sources (HTTP, FTP, SFTP), transforms it via configurable mapping rules, and routes it outbound. Everything is configured through a web UI backed by this API.

### Request lifecycle

1. External systems POST to `/inbound/inboundrun` or hit a DDEP API path (`/dapi/...`).
2. `handler/inbound.js` or `handler/dapi.js` loads the item's full configuration from MongoDB (inbound settings, mapping profiles, filters, outbound settings, schedule, party credentials).
3. `common/common.js` executes the pipeline: inbound filter → mapping (via HyperFormula for formula evaluation + camaro for XML→JSON) → outbound validation → outbound filter → outbound mapping → send to target endpoint.
4. Each step is logged asynchronously via BullMQ queues (`logQueueCon`, `logAlertQueueCon`, `logDiffQueueCon`).

### Scheduling

`app.js` runs a `node-cron` job every minute that self-calls `GET /scheduler_job/scheduling`. `handler/scheduler_job.js` queries all active scheduled items and triggers their inbound/outbound runs.

### Queue system (`queues/`)

BullMQ + Redis backs three families of queues:
- **Log queues** (`logWorker`, `logalertWorker`, `logdiffWorker`) — batch-write log history to MongoDB.
- **Mail queues** (`mailWorker`, `mailActionWorker`, `mailAlertWorker`) — send notification/alert emails.
- **Resend queue** (`resendMailWorker`) — retry failed email deliveries; failures are stored in `email_failures` collection.

All queue connections share one Redis `connection` instance from `queues/config/queuesConfigartion.js`.

### Key directories

| Path | Purpose |
|---|---|
| `handler/` | Core data-pipeline logic (`inbound.js`, `dapi.js`, `scheduler_job.js`) |
| `common/common.js` | Shared pipeline functions: `inboundMappingHandler`, `outboundMappingHandler`, `inboundFilterHandler`, `outboundFilterHandler`, `outboundValidationHandler`, `addToLogQueue`, etc. |
| `controllers/` | Thin DB-access layer; one controller per model |
| `models/` | Mongoose schemas |
| `routers/` | Express route registration; delegates to controllers or handlers |
| `middleware/index.js` | `checkAuthorization` (JWT cookie → permission check) and `checkCompanyCode` |
| `my_modules/aes.js` | AES-CBC/ECB encryption used for credential fields |
| `my_modules/MyCustomPlugin.js` | Custom HyperFormula function plugin for formula-based mappings |
| `monitor/monitor.js` | Startup DB health check, uncaught-exception storage, log-file cleanup |
| `output/` | Runtime-generated directories: `log/`, `inbounds/`, `history/` (created on startup if absent) |

### Auth / multi-tenancy

Authentication is JWT-based via a `Token` cookie set by an external SSO (GIMA). `EnableGima=false` bypasses the JWT check entirely (used in standalone mode). All data is scoped by `companyCode` and `projectId` fields on every document. `config/index.js` holds the hardcoded `companyCode: "ddep"` used in standalone mode.

### Data-flow globals (known issue)

`handler/inbound.js` and `handler/dapi.js` use module-level mutable variables (e.g. `outboundFormatDataParentKey`, `filterParentKey`) to carry state through the pipeline. These are not safe under concurrent requests in the same worker process — be careful when modifying pipeline logic.
