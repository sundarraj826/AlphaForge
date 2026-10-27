
import 'dotenv/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';

import {
    ConfirmedSandboxOrderRejectionError,
    submitSandboxLimitOrder,
} from './services/upstox-order-submit.service.mjs';
import { getSandboxOrderDetails } from './services/upstox-order.service.mjs';
import { handleMarketCandles } from './routes/market-candles.routes.mjs';
import { handlePaperProposals } from './routes/paper-proposals.routes.mjs';
import {
    loadSandboxOrderRiskConfig,
    validateSandboxLimitOrder,
} from './config/order-risk.config.mjs';
import { loadOrderIntentDatabasePath } from './config/order-intent.config.mjs';
import {
    createOrderIntentStore,
    OrderIntentStoreError,
} from './storage/order-intent.store.mjs';
import { loadPaperProposalDatabasePath } from './config/paper-proposal.config.mjs';
import {
    createPaperProposalStore,
} from './storage/paper-proposal.store.mjs';


const PORT = Number(process.env.PORT) || 3000;
const API_HOST = '127.0.0.1';
const MAX_BODY_SIZE = 1024 * 1024;
const LOCAL_API_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

const ALLOWED_ORIGIN = 'http://localhost:4200';

function getConfiguredLocalApiToken(token) {
    return typeof token === 'string' && LOCAL_API_TOKEN_PATTERN.test(token)
        ? token
        : null;
}

function hasValidBearerToken(authorization, expectedToken) {
    const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(authorization ?? '');

    if (!match) {
        return false;
    }

    const providedDigest = createHash('sha256').update(match[1]).digest();
    const expectedDigest = createHash('sha256').update(expectedToken).digest();

    return timingSafeEqual(providedDigest, expectedDigest);
}

function setCorsHeaders(request, response) {
    const origin = request.headers.origin;

    if (origin === ALLOWED_ORIGIN) {
        response.setHeader(
            'Access-Control-Allow-Origin',
            ALLOWED_ORIGIN,
        );
        response.setHeader(
            'Vary',
            'Origin',
        );
        response.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, OPTIONS',
        );
        response.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, Idempotency-Key',
        );
    }
}

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });

    response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
    let body = '';
    let size = 0;

    for await (const chunk of request) {
        size += chunk.length;

        if (size > MAX_BODY_SIZE) {
            const error = new Error('Request body is too large.');
            error.statusCode = 413;
            throw error;
        }

        body += chunk.toString('utf8');
    }

    try {
        return JSON.parse(body);
    } catch {
        const error = new Error('A valid JSON request body is required.');
        error.statusCode = 400;
        throw error;
    }
}

export function createApiServer({
    localApiToken = process.env.ALPHAFORGE_LOCAL_API_TOKEN,
    submitOrder = submitSandboxLimitOrder,
    loadOrderRiskConfig = loadSandboxOrderRiskConfig,
    orderIntentStore: injectedOrderIntentStore,
    orderIntentStoreFactory = () =>
        createOrderIntentStore({
            databasePath: loadOrderIntentDatabasePath(),
        }),
    paperProposalStore: injectedPaperProposalStore,
    paperProposalStoreFactory = () =>
        createPaperProposalStore({
            databasePath: loadPaperProposalDatabasePath(),
        }),
} = {}) {
    const configuredLocalApiToken =
        getConfiguredLocalApiToken(localApiToken);
    let orderIntentStore = injectedOrderIntentStore;
    let orderIntentStoreInitializationError;
    let paperProposalStore = injectedPaperProposalStore;
    let paperProposalStoreInitializationError = false;

    if (!orderIntentStore) {
        try {
            orderIntentStore = orderIntentStoreFactory();
        } catch {
            orderIntentStoreInitializationError =
                new OrderIntentStoreError();
        }
    }

    function getOrderIntentStore() {
        if (orderIntentStoreInitializationError) {
            throw orderIntentStoreInitializationError;
        }

        if (!orderIntentStore) {
            try {
                orderIntentStore = orderIntentStoreFactory();
            } catch {
                orderIntentStoreInitializationError =
                    new OrderIntentStoreError();
                throw orderIntentStoreInitializationError;
            }
        }

        return orderIntentStore;
    }

    function getPaperProposalStore() {
        if (paperProposalStoreInitializationError) {
            throw new Error('Paper-proposal storage is unavailable.');
        }

        if (!paperProposalStore) {
            try {
                paperProposalStore = paperProposalStoreFactory();
            } catch {
                paperProposalStoreInitializationError = true;
                throw new Error('Paper-proposal storage is unavailable.');
            }
        }

        return paperProposalStore;
    }

    return createHttpServer(async (request, response) => {
        setCorsHeaders(request, response);

        if (
            request.method === 'OPTIONS' &&
            request.headers.origin !== ALLOWED_ORIGIN
        ) {
            response.writeHead(403);
            response.end();
            return;
        }

        if (request.method === 'OPTIONS') {
            response.writeHead(204);
            response.end();
            return;
        }

        try {
            const url = new URL(
                request.url ?? '/',
                'http://localhost',
            );

            if (
                request.method === 'GET' &&
                url.pathname === '/api/health'
            ) {
                return sendJson(response, 200, {
                    status: 'ok',
                    service: 'alphaforge-api',
                    mode: 'sandbox',
                });
            }

            if (
                request.method === 'GET' &&
                url.pathname === '/api/market/candles'
            ) {
                return handleMarketCandles(request, response);
            }

            if (
                request.method === 'GET' &&
                url.pathname === '/api/paper-proposals'
            ) {
                if (
                    !configuredLocalApiToken ||
                    !hasValidBearerToken(
                        request.headers.authorization,
                        configuredLocalApiToken,
                    )
                ) {
                    return sendJson(response, 401, {
                        status: 'error',
                        message: 'Valid local API credentials are required.',
                    });
                }

                return handlePaperProposals(request, response, {
                    getStore: getPaperProposalStore,
                });
            }

            if (
                request.method === 'GET' &&
                url.pathname.startsWith('/api/orders/')
            ) {
                // Read-only lookup stays unauthenticated for the local UI; the server binds to loopback only.
                const orderId = decodeURIComponent(
                    url.pathname.slice('/api/orders/'.length),
                );

                const order = await getSandboxOrderDetails(orderId);

                return sendJson(response, 200, {
                    status: 'success',
                    data: order,
                });
            }

            if (
                request.method === 'POST' &&
                url.pathname === '/api/orders'
            ) {
                if (
                    !configuredLocalApiToken ||
                    !hasValidBearerToken(
                        request.headers.authorization,
                        configuredLocalApiToken,
                    )
                ) {
                    return sendJson(response, 401, {
                        status: 'error',
                        message: 'Valid local API credentials are required.',
                    });
                }

                const idempotencyKey =
                    request.headers['idempotency-key'];
                if (
                    typeof idempotencyKey !== 'string' ||
                    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
                ) {
                    return sendJson(response, 400, {
                        status: 'error',
                        message: 'A valid Idempotency-Key header is required.',
                    });
                }

                const order = await readJsonBody(request);
                const riskConfig = loadOrderRiskConfig();
                const validatedOrder =
                    validateSandboxLimitOrder(order, riskConfig);

                const keyHash = createHash('sha256')
                    .update(idempotencyKey)
                    .digest('hex');
                const fingerprint = createHash('sha256')
                    .update(JSON.stringify(validatedOrder))
                    .digest('hex');
                const store = getOrderIntentStore();
                const claim = store.claim(
                    keyHash,
                    fingerprint,
                    validatedOrder,
                );

                if (!claim.created) {
                    if (claim.intent.state === 'SUBMITTED') {
                        return sendJson(response, 200, {
                            status: 'success',
                            data: claim.intent.result,
                        });
                    }

                    if (claim.intent.state === 'REJECTED') {
                        return sendJson(response, 422, {
                            status: 'error',
                            state: 'REJECTED',
                            message:
                                'Upstox Sandbox confirmed that the order was rejected.',
                        });
                    }

                    return sendJson(response, 202, {
                        status: 'pending',
                        state: claim.intent.state,
                        message:
                            claim.intent.state === 'UNKNOWN'
                                ? 'The submission outcome is unknown; this key will not submit again.'
                                : 'The submission is still in progress.',
                    });
                }

                let result;
                try {
                    result = await submitOrder(validatedOrder);
                } catch (error) {
                    if (
                        error instanceof
                        ConfirmedSandboxOrderRejectionError
                    ) {
                        store.markRejected(keyHash);
                        return sendJson(response, 422, {
                            status: 'error',
                            state: 'REJECTED',
                            message:
                                'Upstox Sandbox confirmed that the order was rejected.',
                        });
                    }

                    store.markUnknown(keyHash);
                    return sendJson(response, 202, {
                        status: 'pending',
                        state: 'UNKNOWN',
                        message:
                            'The submission outcome is unknown; this key will not submit again.',
                    });
                }

                store.markSubmitted(keyHash, result);

                return sendJson(response, 201, {
                    status: 'success',
                    data: result,
                });
            }

            return sendJson(response, 404, {
                status: 'error',
                message: 'API endpoint not found.',
            });
        } catch (error) {
            if (response.headersSent) {
                response.destroy();
                return;
            }

            const statusCode = error.statusCode ?? 502;
            let message = 'The API request could not be completed.';

            if (
                statusCode === 400 ||
                statusCode === 413 ||
                statusCode === 422 ||
                statusCode === 409
            ) {
                message = error.message;
            } else if (statusCode === 503) {
                message = error instanceof OrderIntentStoreError
                    ? 'Order submission persistence is unavailable.'
                    : 'Order submission risk limits are unavailable.';
            }

            return sendJson(response, statusCode, {
                status: 'error',
                message,
            });
        }
    });
}

export function listenApiServer(server, port = PORT) {
    return server.listen(port, API_HOST);
}

const isMainModule =
    process.argv[1] &&
    import.meta.url === new URL(
        `file://${process.argv[1].replaceAll('\\', '/')}`,
    ).href;

if (isMainModule) {
    const server = createApiServer();

    listenApiServer(server).on('listening', () => {
        console.log(`AlphaForge API listening on 127.0.0.1:${PORT}`);
        console.log('Trading mode: Upstox Sandbox only');
    });
}
