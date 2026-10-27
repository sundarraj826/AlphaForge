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
not authentication. Its preflight response permits the `Authorization` and
`Content-Type` headers only for that origin.

`GET /api/orders/:id` remains unauthenticated and read-only for the local order
lookup UI. It is reachable only through the loopback-bound API, but other
processes running as the same user can access it. The API continues to use the
Upstox Sandbox host and existing Sandbox credential checks.
