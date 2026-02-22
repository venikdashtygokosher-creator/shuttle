# ShuttlePro API Scaffold

This is a lightweight backend scaffold to evolve the static prototype into a real client/server architecture.

## Run

```bash
node backend/server.js
```

## Endpoints

- `GET /api/health` - service status.
- `GET /api/bootstrap` - returns initial state for UI bootstrap.
- `POST /api/sync` - receives full UI state payload (prototype sync strategy).

## Next Production Steps

1. Replace in-memory `db` with PostgreSQL.
2. Add authentication and operator roles.
3. Split `/api/sync` into domain endpoints (`/passengers`, `/trips`, `/plans`, `/sales`).
4. Add validation, audit logging, and pagination.
