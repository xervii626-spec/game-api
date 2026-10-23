# Casino Backend (NestJS)

Separate folder (not monorepo). Wallet stubs ready for BetConstruct RGS.

## Wallet endpoints (Phase B — RGS callbacks)

| Method | Path |
|--------|------|
| Authenticate | `POST /wallet/authenticate` |
| GetBalance | `POST /wallet/get-balance` |
| Withdraw | `POST /wallet/withdraw` |
| Deposit | `POST /wallet/deposit` |
| Rollback | `POST /wallet/rollback` |

All require `PublicKey`. While `SHARED_KEY=change_me_shared_key`, verify is skipped (local).  
Set a real `SHARED_KEY` before staging with BetConstruct.

## Commands

```bash
# from repo root
docker compose up -d postgres

cd backend
cp .env.example .env   # if needed
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Swagger: http://localhost:5000/docs

## Phase A — test APIs

```bash
# Create player (+ wallet)
curl -X POST http://localhost:5000/players -H "Content-Type: application/json" -d "{\"username\":\"player1\",\"nickname\":\"Player One\",\"password\":\"secret12\",\"currency\":\"USD\",\"initialBalance\":\"1000\"}"

# Get player / balance
curl http://localhost:5000/players/1
curl http://localhost:5000/players/1/balance

# Credit real balance
curl -X POST http://localhost:5000/players/1/credit -H "Content-Type: application/json" -d "{\"amount\":\"50\"}"

# Create session token
curl -X POST http://localhost:5000/sessions/player/1
```
