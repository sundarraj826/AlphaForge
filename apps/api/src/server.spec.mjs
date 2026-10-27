import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiServer, listenApiServer } from './server.mjs';

const VALID_API_TOKEN = 'a'.repeat(48);
const VALID_ORDER = {
    instrumentToken: 'NSE_EQ|INE669E01016',
    quantity: 1,
    product: 'I',
    validity: 'DAY',
    price: 100,
    orderType: 'LIMIT',
    transactionType: 'BUY',
};

async function startServer(t, options) {
    const server = createApiServer(options);
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        listenApiServer(server, 0).once('listening', resolve);
    });
    t.after(() => new Promise(resolve => server.close(resolve)));

    const address = server.address();
    return {
        address,
        baseUrl: `http://127.0.0.1:${address.port}`,
    };
}

async function postOrder(baseUrl, authorization) {
    return fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify(VALID_ORDER),
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
            'Access-Control-Request-Headers': 'authorization,content-type',
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
        ['authorization', 'content-type'],
    );

    const disallowedResponse = await fetch(`${baseUrl}/api/orders`, {
        method: 'OPTIONS',
        headers: {
            Origin: 'http://localhost:4201',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'authorization,content-type',
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
