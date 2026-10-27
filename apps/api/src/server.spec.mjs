import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import { createApiServer, listenApiServer } from './server.mjs';
import { OrderRiskConfigurationError } from './config/order-risk.config.mjs';
import {
    ConfirmedSandboxOrderRejectionError,
    submitSandboxLimitOrder,
} from './services/upstox-order-submit.service.mjs';
import { createOrderIntentStore } from './storage/order-intent.store.mjs';

const VALID_API_TOKEN = 'a'.repeat(48);
const VALID_IDEMPOTENCY_KEY = 'test-idempotency-key-0001';
const VALID_ORDER = {
    instrumentToken: 'NSE_EQ|INE669E01016',
    quantity: 1,
    product: 'I',
    validity: 'DAY',
    price: 100,
    orderType: 'LIMIT',
    transactionType: 'BUY',
};
const TEST_RISK_CONFIG = {
    allowedInstruments: [VALID_ORDER.instrumentToken],
    maxQuantity: 5,
    maxNotional: 500,
};

async function startServer(t, options) {
    let temporaryDirectory;
    let orderIntentStore = options.orderIntentStore;
    if (!orderIntentStore && !options.orderIntentStoreFactory) {
        temporaryDirectory = mkdtempSync(
            path.join(tmpdir(), 'alphaforge-api-test-'),
        );
        orderIntentStore = createOrderIntentStore({
            databasePath: path.join(
                temporaryDirectory,
                'order-intents.sqlite',
            ),
        });
    }

    const server = createApiServer({
        loadOrderRiskConfig: () => TEST_RISK_CONFIG,
        ...(orderIntentStore ? { orderIntentStore } : {}),
        ...options,
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        listenApiServer(server, 0).once('listening', resolve);
    });
    let shutdownPromise;
    const shutdown = () => {
        if (shutdownPromise) {
            return shutdownPromise;
        }

        shutdownPromise = new Promise(resolve => {
            server.close(() => resolve());
        }).then(() => {
            if (temporaryDirectory) {
                orderIntentStore.close();
                rmSync(temporaryDirectory, { recursive: true, force: true });
            }
        });
        return shutdownPromise;
    };
    t.after(shutdown);

    const address = server.address();
    return {
        address,
        baseUrl: `http://127.0.0.1:${address.port}`,
        shutdown,
    };
}

async function postOrder(
    baseUrl,
    authorization,
    order = VALID_ORDER,
    idempotencyKey = VALID_IDEMPOTENCY_KEY,
) {
    return fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
            ...(idempotencyKey === null
                ? {}
                : { 'Idempotency-Key': idempotencyKey }),
        },
        body: JSON.stringify(order),
    });
}

test('binds the API listener to loopback', async (t) => {
    const { address } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => ({ status: 'success', orderIds: ['mock-id'] }),
    });

    assert.equal(address.address, '127.0.0.1');
});

test('rejects a missing bearer token without invoking order submission', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl);

    assert.equal(response.status, 401);
    assert.equal(submissionCalled, false);
});

test('rejects an invalid bearer token without invoking order submission', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, 'Bearer invalid-token');

    assert.equal(response.status, 401);
    assert.equal(submissionCalled, false);
});

test('disables order submission when the local API token is missing', async (t) => {
    let submissionCalled = false;
    const configuredToken = process.env.ALPHAFORGE_LOCAL_API_TOKEN;
    delete process.env.ALPHAFORGE_LOCAL_API_TOKEN;

    try {
        const { baseUrl } = await startServer(t, {
            submitOrder: async () => {
                submissionCalled = true;
                return {};
            },
        });
        const response = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
        );

        assert.equal(response.status, 401);
        assert.equal(submissionCalled, false);
    } finally {
        if (configuredToken === undefined) {
            delete process.env.ALPHAFORGE_LOCAL_API_TOKEN;
        } else {
            process.env.ALPHAFORGE_LOCAL_API_TOKEN = configuredToken;
        }
    }
});

test('disables order submission when the configured local API token is empty', async (t) => {
    let submissionCalled = false;
    const configuredToken = process.env.ALPHAFORGE_LOCAL_API_TOKEN;
    process.env.ALPHAFORGE_LOCAL_API_TOKEN = '';

    try {
        const { baseUrl } = await startServer(t, {
            submitOrder: async () => {
                submissionCalled = true;
                return {};
            },
        });
        const response = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
        );

        assert.equal(response.status, 401);
        assert.equal(submissionCalled, false);
    } finally {
        if (configuredToken === undefined) {
            delete process.env.ALPHAFORGE_LOCAL_API_TOKEN;
        } else {
            process.env.ALPHAFORGE_LOCAL_API_TOKEN = configuredToken;
        }
    }
});

test('disables order submission when the configured token is invalid', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: 'too-short',
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, 'Bearer too-short');

    assert.equal(response.status, 401);
    assert.equal(submissionCalled, false);
});

test('rejects a malformed Authorization header without invoking order submission', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, `Basic ${VALID_API_TOKEN}`);

    assert.equal(response.status, 401);
    assert.equal(submissionCalled, false);
});

test('does not expose or log the configured token on authentication failure', async (t) => {
    let submissionCalled = false;
    const logOutput = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = (...values) => logOutput.push(values.join(' '));
    console.error = (...values) => logOutput.push(values.join(' '));

    try {
        const { baseUrl } = await startServer(t, {
            localApiToken: VALID_API_TOKEN,
            submitOrder: async () => {
                submissionCalled = true;
                return {};
            },
        });

        const response = await postOrder(baseUrl, 'Bearer invalid-token');
        const responseBody = await response.text();

        assert.equal(response.status, 401);
        assert.equal(responseBody.includes(VALID_API_TOKEN), false);
        assert.equal(logOutput.join('\n').includes(VALID_API_TOKEN), false);
        assert.equal(submissionCalled, false);
    } finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    }
});

test('CORS permits Authorization only for the configured local Angular origin', async (t) => {
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => ({ status: 'success', orderIds: ['mock-id'] }),
    });

    const allowedResponse = await fetch(`${baseUrl}/api/orders`, {
        method: 'OPTIONS',
        headers: {
            Origin: 'http://localhost:4200',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers':
                'authorization,content-type,idempotency-key',
        },
    });

    assert.equal(allowedResponse.status, 204);
    assert.equal(
        allowedResponse.headers.get('access-control-allow-origin'),
        'http://localhost:4200',
    );
    assert.deepEqual(
        allowedResponse.headers
            .get('access-control-allow-headers')
            .split(',')
            .map(header => header.trim().toLowerCase())
            .sort(),
        ['authorization', 'content-type', 'idempotency-key'],
    );

    const disallowedResponse = await fetch(`${baseUrl}/api/orders`, {
        method: 'OPTIONS',
        headers: {
            Origin: 'http://localhost:4201',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers':
                'authorization,content-type,idempotency-key',
        },
    });

    assert.equal(disallowedResponse.status, 403);
    assert.equal(
        disallowedResponse.headers.get('access-control-allow-origin'),
        null,
    );
});

test('accepts a valid local token and submits through the mocked Sandbox provider', async (t) => {
    let receivedOrder;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async (order) => {
            receivedOrder = order;
            return { status: 'success', orderIds: ['mock-sandbox-order-id'] };
        },
    });

    const response = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
    );

    assert.equal(response.status, 201);
    assert.deepEqual(receivedOrder, VALID_ORDER);
    assert.deepEqual(await response.json(), {
        status: 'success',
        data: {
            status: 'success',
            orderIds: ['mock-sandbox-order-id'],
        },
    });
});

test('rejects unsupported instruments before invoking the submission provider', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, `Bearer ${VALID_API_TOKEN}`, {
        ...VALID_ORDER,
        instrumentToken: 'NSE_EQ|NOT_APPROVED',
    });

    assert.equal(response.status, 422);
    assert.equal(submissionCalled, false);
});

test('rejects quantity above the configured maximum before submission', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, `Bearer ${VALID_API_TOKEN}`, {
        ...VALID_ORDER,
        quantity: TEST_RISK_CONFIG.maxQuantity + 1,
    });

    assert.equal(response.status, 422);
    assert.equal(submissionCalled, false);
});

test('rejects notional above the configured maximum before submission', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, `Bearer ${VALID_API_TOKEN}`, {
        ...VALID_ORDER,
        price: TEST_RISK_CONFIG.maxNotional + 1,
    });

    assert.equal(response.status, 422);
    assert.equal(submissionCalled, false);
});

test('accepts exact quantity and notional limits through the mocked provider', async (t) => {
    let receivedOrder;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async (order) => {
            receivedOrder = order;
            return { status: 'success', orderIds: ['mock-limit-order'] };
        },
    });

    const boundaryOrder = {
        ...VALID_ORDER,
        quantity: TEST_RISK_CONFIG.maxQuantity,
        price: TEST_RISK_CONFIG.maxNotional / TEST_RISK_CONFIG.maxQuantity,
    };
    const response = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        boundaryOrder,
    );

    assert.equal(response.status, 201);
    assert.deepEqual(receivedOrder, boundaryOrder);
});

test('uses an exact decimal notional boundary at the API boundary', async (t) => {
    let receivedOrder;
    const decimalRiskConfig = {
        allowedInstruments: [VALID_ORDER.instrumentToken],
        maxQuantity: 3,
        maxNotional: '0.3',
    };
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        loadOrderRiskConfig: () => decimalRiskConfig,
        submitOrder: async (order) => {
            receivedOrder = order;
            return { status: 'success', orderIds: ['mock-decimal-order'] };
        },
    });

    const boundaryOrder = {
        ...VALID_ORDER,
        quantity: 3,
        price: 0.1,
    };
    const boundaryResponse = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        boundaryOrder,
    );
    assert.equal(boundaryResponse.status, 201);
    assert.deepEqual(receivedOrder, boundaryOrder);

    const aboveLimitResponse = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        { ...boundaryOrder, price: 0.100001 },
        'test-idempotency-key-above-limit',
    );
    assert.equal(aboveLimitResponse.status, 422);
});

test('fails closed with 503 when order risk configuration is invalid', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        loadOrderRiskConfig: () => {
            throw new OrderRiskConfigurationError();
        },
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    const response = await postOrder(baseUrl, `Bearer ${VALID_API_TOKEN}`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.match(body.message, /risk limits are unavailable/);
    assert.equal(submissionCalled, false);
});

test('returns 400 for invalid quantity or limit price before submission', async (t) => {
    let submissionCalled = false;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalled = true;
            return {};
        },
    });

    for (const invalidOrder of [
        { ...VALID_ORDER, quantity: Number.MAX_SAFE_INTEGER + 1 },
        { ...VALID_ORDER, price: Number.POSITIVE_INFINITY },
        { ...VALID_ORDER, price: 0 },
    ]) {
        const response = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            invalidOrder,
        );
        assert.equal(response.status, 400);
    }

    assert.equal(submissionCalled, false);
});

test('requires a valid Idempotency-Key after authentication', async (t) => {
    let submissionCalls = 0;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalls++;
            return { status: 'success', orderIds: ['mock-key-order'] };
        },
    });

    for (const idempotencyKey of [null, 'invalid key', 'short']) {
        const response = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            idempotencyKey,
        );
        assert.equal(response.status, 400);
    }

    assert.equal(submissionCalls, 0);
});

test('replays a successful result for a duplicate key without resubmitting', async (t) => {
    let submissionCalls = 0;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalls++;
            return {
                status: 'success',
                orderIds: ['mock-idempotent-order'],
            };
        },
    });

    const first = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );
    const replay = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );

    assert.equal(first.status, 201);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), {
        status: 'success',
        data: {
            status: 'success',
            orderIds: ['mock-idempotent-order'],
        },
    });
    assert.equal(submissionCalls, 1);
});

test('hashes the idempotency key before persisting the intent', async (t) => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-key-hash-test-'),
    );
    const store = createOrderIntentStore({
        databasePath: path.join(
            temporaryDirectory,
            'order-intents.sqlite',
        ),
    });
    t.after(() => {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    });
    const { baseUrl } = await startServer(t, {
        orderIntentStore: store,
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => ({
            status: 'success',
            orderIds: ['mock-key-hash-order'],
        }),
    });

    const response = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );
    assert.equal(response.status, 201);

    const database = new Database(store.databasePath, { readonly: true });
    try {
        const row = database.prepare(
            'SELECT key_hash FROM order_intents',
        ).get();
        assert.equal(
            row.key_hash,
            createHash('sha256')
                .update(VALID_IDEMPOTENCY_KEY)
                .digest('hex'),
        );
        assert.notEqual(row.key_hash, VALID_IDEMPOTENCY_KEY);
    } finally {
        database.close();
    }
});

test('rejects reuse of an idempotency key for a different order payload', async (t) => {
    let submissionCalls = 0;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalls++;
            return { status: 'success', orderIds: ['mock-idempotent-order'] };
        },
    });

    const first = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );
    const conflict = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        { ...VALID_ORDER, quantity: 2 },
        VALID_IDEMPOTENCY_KEY,
    );

    assert.equal(first.status, 201);
    assert.equal(conflict.status, 409);
    assert.equal(submissionCalls, 1);
});

test('serializes concurrent duplicate requests through the durable claim', async (t) => {
    let submissionCalls = 0;
    let releaseSubmission;
    let signalProviderStarted;
    const providerStarted = new Promise(resolve => {
        signalProviderStarted = resolve;
    });
    const providerBlocked = new Promise(resolve => {
        releaseSubmission = resolve;
    });
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalls++;
            signalProviderStarted();
            await providerBlocked;
            return {
                status: 'success',
                orderIds: ['mock-concurrent-order'],
            };
        },
    });

    const firstPromise = postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );
    try {
        await providerStarted;
        const duplicate = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );

        assert.equal(duplicate.status, 202);
        assert.equal((await duplicate.json()).state, 'SUBMITTING');
    } finally {
        releaseSubmission();
    }

    assert.equal((await firstPromise).status, 201);
    assert.equal(submissionCalls, 1);
});

test('prevents duplicate submissions across independent API and SQLite instances', async (t) => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-independent-api-test-'),
    );
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    const firstStore = createOrderIntentStore({ databasePath });
    const secondStore = createOrderIntentStore({ databasePath });
    let providerCalls = 0;
    let releaseFirstProviderCall;
    let signalProviderStarted;
    const providerStarted = new Promise(resolve => {
        signalProviderStarted = resolve;
    });
    const firstProviderCall = new Promise(resolve => {
        releaseFirstProviderCall = resolve;
    });
    const submitOrder = async () => {
        providerCalls++;
        if (providerCalls === 1) {
            signalProviderStarted();
            await firstProviderCall;
        }
        return {
            status: 'success',
            orderIds: ['mock-independent-store-order'],
        };
    };
    let firstServer;
    let secondServer;

    try {
        firstServer = await startServer(t, {
            orderIntentStore: firstStore,
            localApiToken: VALID_API_TOKEN,
            submitOrder,
        });
        secondServer = await startServer(t, {
            orderIntentStore: secondStore,
            localApiToken: VALID_API_TOKEN,
            submitOrder,
        });

        const firstRequest = postOrder(
            firstServer.baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );
        const secondRequest = postOrder(
            secondServer.baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );

        await providerStarted;
        let firstResponse;
        let secondResponse;
        try {
            const firstCompletedResponse = await Promise.race([
                firstRequest,
                secondRequest,
            ]);
            assert.equal(firstCompletedResponse.status, 202);
            assert.equal(
                (await firstCompletedResponse.json()).state,
                'SUBMITTING',
            );
        } finally {
            releaseFirstProviderCall();
        }

        [firstResponse, secondResponse] = await Promise.all([
            firstRequest,
            secondRequest,
        ]);
        assert.deepEqual(
            [firstResponse.status, secondResponse.status].sort(),
            [201, 202],
        );
        assert.equal(providerCalls, 1);
    } finally {
        releaseFirstProviderCall();
        await secondServer?.shutdown();
        await firstServer?.shutdown();
        firstStore.close();
        secondStore.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('does not resubmit an order after an ambiguous provider failure', async (t) => {
    let submissionCalls = 0;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalls++;
            throw new Error('simulated connection timeout');
        },
    });

    const first = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );
    const retry = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );

    assert.equal(first.status, 202);
    assert.equal((await first.json()).state, 'UNKNOWN');
    assert.equal(retry.status, 202);
    assert.equal((await retry.json()).state, 'UNKNOWN');
    assert.equal(submissionCalls, 1);
});

test('does not resubmit after a malformed successful provider response', async (t) => {
    const riskEnvironment = {
        UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS:
            process.env.UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS,
        UPSTOX_SANDBOX_MAX_ORDER_QUANTITY:
            process.env.UPSTOX_SANDBOX_MAX_ORDER_QUANTITY,
        UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL:
            process.env.UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL,
    };
    process.env.UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS =
        TEST_RISK_CONFIG.allowedInstruments.join(',');
    process.env.UPSTOX_SANDBOX_MAX_ORDER_QUANTITY =
        String(TEST_RISK_CONFIG.maxQuantity);
    process.env.UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL =
        String(TEST_RISK_CONFIG.maxNotional);

    let providerCalls = 0;
    try {
        const { baseUrl } = await startServer(t, {
            localApiToken: VALID_API_TOKEN,
            submitOrder: order => submitSandboxLimitOrder(order, {
                clientFactory: () => ({
                    sandbox: true,
                    basePath: 'https://api-sandbox.upstox.com',
                    orderBasePath: 'https://api-sandbox.upstox.com',
                }),
                orderApiFactory: () => ({
                    placeOrder: (request, options, callback) => {
                        providerCalls++;
                        callback(null, {
                            status: 'success',
                            data: {
                                orderIds: ['mock-valid-order-id', null],
                            },
                        });
                    },
                }),
            }),
        });

        const first = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );
        const retry = await postOrder(
            baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );

        assert.equal(first.status, 202);
        assert.equal((await first.json()).state, 'UNKNOWN');
        assert.equal(retry.status, 202);
        assert.equal((await retry.json()).state, 'UNKNOWN');
        assert.equal(providerCalls, 1);
    } finally {
        for (const [name, value] of Object.entries(riskEnvironment)) {
            if (value === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = value;
            }
        }
    }
});

test('reopens the database and replays a persisted submission result', async (t) => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-restart-test-'),
    );
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    const firstStore = createOrderIntentStore({ databasePath });
    let submissionCalls = 0;
    let firstServer;
    let reopenedStore;
    let restartedServer;
    try {
        firstServer = await startServer(t, {
            orderIntentStore: firstStore,
            localApiToken: VALID_API_TOKEN,
            submitOrder: async () => {
                submissionCalls++;
                return {
                    status: 'success',
                    orderIds: ['mock-restart-order'],
                };
            },
        });

        const first = await postOrder(
            firstServer.baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );
        assert.equal(first.status, 201);
        await firstServer.shutdown();
        firstStore.close();

        reopenedStore = createOrderIntentStore({ databasePath });
        restartedServer = await startServer(t, {
            orderIntentStore: reopenedStore,
            localApiToken: VALID_API_TOKEN,
            submitOrder: async () => {
                submissionCalls++;
                return {
                    status: 'success',
                    orderIds: ['unexpected-resubmit'],
                };
            },
        });

        const replay = await postOrder(
            restartedServer.baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );

        assert.equal(replay.status, 200);
        assert.deepEqual((await replay.json()).data.orderIds, [
            'mock-restart-order',
        ]);
        assert.equal(submissionCalls, 1);
    } finally {
        await restartedServer?.shutdown();
        await firstServer?.shutdown();
        reopenedStore?.close();
        firstStore.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('recovers persisted SUBMITTING intents as UNKNOWN after restart', async (t) => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-recovery-test-'),
    );
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    let now = 1_000_000;
    const firstStore = createOrderIntentStore({
        databasePath,
        now: () => now,
        staleAfterMs: 1_000,
    });
    const keyHash = createHash('sha256')
        .update(VALID_IDEMPOTENCY_KEY)
        .digest('hex');
    firstStore.claim(keyHash, 'b'.repeat(64), VALID_ORDER);
    firstStore.close();

    now += 1_001;
    const recoveredStore = createOrderIntentStore({
        databasePath,
        now: () => now,
        staleAfterMs: 1_000,
    });
    t.after(() => {
        recoveredStore.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    });
    const recovered = recoveredStore.claim(
        keyHash,
        'b'.repeat(64),
        VALID_ORDER,
    );

    assert.equal(recovered.created, false);
    assert.equal(recovered.intent.state, 'UNKNOWN');
});

test('persists confirmed provider rejections and does not retry them', async (t) => {
    let submissionCalls = 0;
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        submitOrder: async () => {
            submissionCalls++;
            throw new ConfirmedSandboxOrderRejectionError();
        },
    });

    const first = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );
    const replay = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
        VALID_ORDER,
        VALID_IDEMPOTENCY_KEY,
    );

    assert.equal(first.status, 422);
    assert.equal((await first.json()).state, 'REJECTED');
    assert.equal(replay.status, 422);
    assert.equal((await replay.json()).state, 'REJECTED');
    assert.equal(submissionCalls, 1);
});

test('fails closed when the order-intent database cannot be initialized', async (t) => {
    let submissionCalls = 0;
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-init-failure-'),
    );
    t.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        orderIntentStoreFactory: () =>
            createOrderIntentStore({ databasePath: temporaryDirectory }),
        submitOrder: async () => {
            submissionCalls++;
            return {};
        },
    });

    const response = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
    );

    assert.equal(response.status, 503);
    assert.equal(submissionCalls, 0);
});

test('fails closed when the order-intent database write fails', async (t) => {
    let submissionCalls = 0;
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-write-failure-'),
    );
    t.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));
    const closedStore = createOrderIntentStore({
        databasePath: path.join(
            temporaryDirectory,
            'order-intents.sqlite',
        ),
    });
    closedStore.close();

    const { baseUrl } = await startServer(t, {
        localApiToken: VALID_API_TOKEN,
        orderIntentStore: closedStore,
        submitOrder: async () => {
            submissionCalls++;
            return {};
        },
    });
    const response = await postOrder(
        baseUrl,
        `Bearer ${VALID_API_TOKEN}`,
    );

    assert.equal(response.status, 503);
    assert.equal(submissionCalls, 0);
});

test('does not resubmit when persisting a provider result fails', async (t) => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-result-write-failure-'),
    );
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    const firstStore = createOrderIntentStore({ databasePath });
    let submissionCalls = 0;
    let firstServer;
    let reopenedStore;
    let restartedServer;

    try {
        firstServer = await startServer(t, {
            orderIntentStore: firstStore,
            localApiToken: VALID_API_TOKEN,
            submitOrder: async () => {
                submissionCalls++;
                firstStore.close();
                return {
                    status: 'success',
                    orderIds: ['mock-result-write-failure'],
                };
            },
        });

        const firstResponse = await postOrder(
            firstServer.baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );
        assert.equal(firstResponse.status, 503);
        assert.equal(submissionCalls, 1);
        await firstServer.shutdown();

        reopenedStore = createOrderIntentStore({ databasePath });
        restartedServer = await startServer(t, {
            orderIntentStore: reopenedStore,
            localApiToken: VALID_API_TOKEN,
            submitOrder: async () => {
                submissionCalls++;
                return {
                    status: 'success',
                    orderIds: ['unexpected-resubmit'],
                };
            },
        });

        const retry = await postOrder(
            restartedServer.baseUrl,
            `Bearer ${VALID_API_TOKEN}`,
            VALID_ORDER,
            VALID_IDEMPOTENCY_KEY,
        );
        assert.equal(retry.status, 202);
        assert.equal((await retry.json()).state, 'SUBMITTING');
        assert.equal(submissionCalls, 1);
    } finally {
        await restartedServer?.shutdown();
        await firstServer?.shutdown();
        firstStore.close();
        reopenedStore?.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});
