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

`POST /api/orders` requires `Authorization: Bearer <local-token>`. CORS remains
restricted to the exact local Angular origin `http://localhost:4200`; CORS is
not authentication. Its preflight response permits the `Authorization` and
`Content-Type` headers only for that origin.

`GET /api/orders/:id` remains unauthenticated and read-only for the local order
lookup UI. It is reachable only through the loopback-bound API, but other
processes running as the same user can access it. The API continues to use the
Upstox Sandbox host and existing Sandbox credential checks.
