# Runbook

Three containers: `postgres` (checkpointer), `mcp` (tool server), `app` (API on
port 3001). The Angular UI is **not** containerized.

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` before the first start.

## Build and start

```bash
docker compose up -d --build
```

The API is published on `http://127.0.0.1:3001` only. Start the UI separately:

```bash
npm --prefix web start      # http://localhost:4200, proxies /api to 3001
```

## Stop

```bash
docker compose down         # keeps checkpoints, fixtures and logs
docker compose down -v      # also deletes them (full reset)
```

## Logs

```bash
docker compose logs -f app
docker compose logs -f mcp
docker compose logs -f postgres
```

The agent's own JSONL run log is in the `logs` volume at
`/usr/src/app/logs/agent-log.jsonl`, and is also served by `GET /api/logs`.

## Kill-and-resume check

Proves a run survives losing the API container, because the graph state lives in
Postgres and not in the process.

```bash
# 1. Start a reroute case. SH-1004 is the cold-chain vaccine shipment;
#    only a recommend_reroute action pauses for approval. Confirm the
#    response says awaiting_approval before continuing.
curl -X POST http://127.0.0.1:3001/api/runs \
  -H 'content-type: application/json' \
  -d '{"shipmentId":"SH-1004"}'

# 2. Kill the API container and bring it back.
docker compose kill app
docker compose up -d app

# 3. Resume the same shipment in the fresh container.
curl -X POST http://127.0.0.1:3001/api/runs/SH-1004/decision \
  -H 'content-type: application/json' \
  -d '{"decision":"approved"}'
```

Step 3 returns the final triage state. If it reports no run awaiting approval,
step 1 did not reach the approval interrupt - check `docker compose logs app`.

## Notes

- `app` shares the `mcp` container's network namespace, so the agent reaches the
  tool server on `127.0.0.1:3002`, which its localhost Host-header guard
  requires. The API port is therefore published by the `mcp` service. If you
  recreate `mcp` rather than restart it, restart `app` afterwards so it rejoins
  the new namespace.
- The `fixtures` volume is seeded from the image the first time it is created.
  Later rebuilds do **not** refresh it, because shipments and prompt overrides
  are edited at runtime. Use `docker compose down -v` to reset to the shipped
  fixtures.
