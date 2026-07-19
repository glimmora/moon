# Moon — Backend API

Base URL: `http://localhost:4000` (or your deployed backend).

All endpoints return JSON. Errors follow `{ "error": "message" }`.

## Authentication

None (public read API). Rate limited to 120 requests/minute per IP.

## Tokens

### `GET /api/tokens`

List tokens across all indexed chains.

**Query params:**
- `chainId` (number) — filter to one chain
- `sort` (`trending` | `new` | `graduated`) — default `trending`

**Response:**
```json
[
  {
    "id": "cuid",
    "chainId": 56,
    "address": "0x…",
    "curve": "0x…",
    "name": "Doge 2.0",
    "symbol": "DOGE2",
    "imageUrl": "https://…",
    "description": "…",
    "supplyTier": 0,
    "curveShape": 1,
    "totalSupply": "1000000000000000000000000000",
    "creator": "0x…",
    "graduated": false,
    "dexPair": null,
    "priceUsd": 0.000123,
    "marketCapUsd": 123456.78,
    "holders": 142,
    "volume24h": 9876.5,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### `GET /api/tokens/:chainId/:address`

Get a single token by chain + address.

### `GET /api/tokens/:chainId/:address/trades?limit=50`

Recent trades for a token. `limit` capped at 200.

```json
[
  {
    "txHash": "0x…",
    "chainId": 56,
    "tokenAddress": "0x…",
    "side": "buy",
    "trader": "0x…",
    "quoteAmount": "100000000000000000",
    "tokenAmount": "500000000000000000000",
    "priceUsd": 0.000123,
    "feeUsd": 0.5,
    "blockNumber": "12345678",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
]
```

### `GET /api/tokens/:chainId/:address/prices?window=24h`

Price history. `window`: `1h`, `24h` (default), `7d`.

```json
[
  { "time": 1704067200000, "priceUsd": 0.0001 },
  { "time": 1704067260000, "priceUsd": 0.00012 }
]
```

### `GET /api/tokens/:chainId/:address/holders`

Top 100 holders (sorted by balance desc).

```json
[
  {
    "chainId": 56,
    "tokenAddress": "0x…",
    "address": "0x…",
    "balance": "5000000000000000000000000",
    "percentage": 5.0,
    "isContract": false,
    "firstSeen": "2024-01-01T00:00:00.000Z"
  }
]
```

### `GET /api/tokens/:chainId/:address/bubblemap`

Holder graph for the bubblemap visualization (top 50 holders + connections).

## Search

### `GET /api/search?q=doge`

Full-text search on token name + symbol.

## Creator fees

### `GET /api/creator-fees/:creator`

Aggregated claimable creator fees across chains.

```json
[
  { "creator": "0x…", "chainId": 56, "quoteAsset": "0x0000…0000", "amount": "500000000000000000" }
]
```

## Referrals

### `GET /api/referrals/:referrer`

Aggregated referral stats.

```json
{
  "volume": "100000000000000000000",
  "rewards": "500000000000000000",
  "count": 42
}
```

## Health

### `GET /api/health`

```json
{ "status": "ok", "timestamp": 1704067200000 }
```

## WebSocket

Connect to `/socket.io` (path `/socket.io`).

### Events

| Event            | Direction | Payload                                  |
| ---------------- | --------- | ---------------------------------------- |
| `subscribe:token`| client →  | `(chainId: number, address: string)`     |
| `trade`          | → client  | `{ chainId, tokenAddress, side, … }`     |
| `graduated`      | → client  | `{ chainId, tokenAddress, dexPair }`     |

After `subscribe:token`, the client receives `trade` and `graduated` events for that token.
