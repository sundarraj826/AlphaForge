# AlphaForge API local security

The API binds to `127.0.0.1` only. `PORT` may change the local port, but the
listening host is fixed; the API does not support a host override. Do not expose
or proxy this service to a LAN or public interface.

Order submission requires the dedicated `ALPHAFORGE_LOCAL_API_TOKEN`
environment variable. Configure a random URL-safe token of at least 32
characters outside the application source. If it is missing or does not match
that format, the API remains available for non-submission features, but
`POST /api/orders` returns `401` and does not invoke the submission provider.
This token is separate from `UPSTOX_SANDBOX_ACCESS_TOKEN`; never send it to the
browser or include it in logs.

Sandbox order submission also requires these server-side risk settings:

- `UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS`: comma-separated exact Upstox instrument
  identifiers. The list must be non-empty and contain no duplicates.
- `UPSTOX_SANDBOX_MAX_ORDER_QUANTITY`: positive safe integer.
- `UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL`: positive decimal amount in the
  instrument's quoted currency.

Missing or invalid risk settings fail closed: authenticated order requests
receive `503` and are not submitted. Invalid order fields receive `400`;
instruments or orders exceeding configured limits receive `422`. The maximum
notional is checked as quantity multiplied by limit price, inclusive of the
configured boundary. Configure these values outside source control; no
defaults are provided.

Limit prices and maximum notionals support plain decimal values with at most
six fractional digits and fifteen integer digits. The service converts them to
scaled integers and uses `BigInt` for exact notional comparison; values outside
that precision or range are rejected rather than rounded.

`POST /api/orders` requires `Authorization: Bearer <local-token>`. CORS remains
restricted to the exact local Angular origin `http://localhost:4200`; CORS is
not authentication. Its preflight response permits the `Authorization`,
`Content-Type`, and `Idempotency-Key` headers only for that origin.

Order submission also requires `ALPHAFORGE_ORDER_INTENTS_DB_PATH` to be an
absolute path for a SQLite database outside the repository. The API creates
the parent directory when needed. If the path is missing, invalid, or the
database cannot be opened or written, order submissions fail closed with
`503`; other API features remain available. The database stores order
intents, validated order fields, their state, and successful order IDs/results.
It never stores the local API token or Upstox access token. Keep the database
in a user-private application-data directory and do not commit it.

`POST /api/orders` also requires a valid `Idempotency-Key` header (16-128
URL-safe characters). The raw key is SHA-256 hashed before storage. The
validated order payload is fingerprinted; reusing a key with a different
payload returns `409`.

The intent is transactionally recorded as `SUBMITTING` before the provider is
called. A confirmed successful response and its order IDs are persisted as
`SUBMITTED`; replaying that key and payload returns the saved result without a
new provider call. `REJECTED` is stored only for an explicit structured
provider rejection response. Network errors, timeouts, malformed responses,
and other uncertain outcomes become `UNKNOWN`. Replaying an `UNKNOWN` or
currently `SUBMITTING` intent returns `202` and never resubmits it. A stale
`SUBMITTING` record (older than 60 seconds) is conservatively changed to
`UNKNOWN` on startup and before a new claim.

There is no automatic retry or guaranteed automatic reconciliation. If a
provider outcome is `UNKNOWN`, use the stored intent and known provider order
IDs (if any) for manual investigation. The current order lookup requires a
known order ID; automatic reconciliation by a client reference or tag is not
implemented because Sandbox lookup guarantees have not been verified.

CORS preflight also permits the `Idempotency-Key` header, still only for the
exact local Angular origin described above.

`GET /api/orders/:id` remains unauthenticated and read-only for the local order
lookup UI. It is reachable only through the loopback-bound API, but other
processes running as the same user can access it. The API continues to use the
Upstox Sandbox host and existing Sandbox credential checks.

The standalone candle eligibility helper is not connected to strategy
execution or order submission. It validates ordered, unique candle timestamps,
uses a session/calendar policy to determine candle end times, and applies a
configured elapsed-time delay and freshness limit. The elapsed-time rule is a
heuristic only; it does not prove that Upstox has finalized a candle or will
not revise it. Confirm the provider's finality semantics, timeframe alignment,
exchange timezone, session schedule, holiday calendar, and delivery delay before
using this helper to generate actionable proposals.

The NIFTY50 paper proposal core evaluates only the server-owned versioned
strategy configuration and injected candles. It can produce a paper BUY signal
with a reference close, but deliberately marks orderable instrument, quantity,
limit price, and order risk check unavailable. It does not submit orders or
call broker APIs. Candle delay and freshness settings are heuristic and require
provider/session confirmation before actionable use.

Paper-proposal persistence is separate from order intents. Configure
`ALPHAFORGE_PAPER_PROPOSALS_DB_PATH` as an absolute SQLite path outside the
repository before creating a paper-proposal store. The database records
validated paper proposal payloads and deduplicates by strategy ID/version,
instrument, signal, and candle timestamp. It does not submit orders or call
broker APIs.

`GET /api/paper-proposals` returns persisted proposals and requires the local
Bearer token. It supports keyset pagination with an optional `limit` from 1 to
100 (default 20) and an opaque `cursor` returned as `nextCursor`. Responses
disable caching and never include the configured database path.
