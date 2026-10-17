
import test from 'node:test';
import assert from 'node:assert/strict';
import { submitSandboxLimitOrder } from './upstox-order-submit.service.mjs';

const validOrder = {
    instrumentToken: 'NSE_EQ|INE669E01016',
    quantity: 1,
    product: 'I',
    validity: 'DAY',
    price: 1,
    orderType: 'LIMIT',
    transactionType: 'BUY',
};

function sandboxClient() {
    return {
        sandbox: true,
        basePath: 'https://api-sandbox.upstox.com',
        orderBasePath: 'https://api-sandbox.upstox.com',
    };
}

function mockOrderApi(callbackResult) {
    return {
        placeOrder: (request, options, callback) => {
            callback(...callbackResult);
        },
    };
}

test('rejects invalid quantity before creating a client', async () => {
    let clientCreated = false;

    assert.throws(
        () =>
            submitSandboxLimitOrder(
                { ...validOrder, quantity: 0 },
                {
                    clientFactory: () => {
                        clientCreated = true;
                        return sandboxClient();
                    },
                    orderApiFactory: () => mockOrderApi([null, {}]),
                },
            ),
        /positive integer/,
    );

    assert.equal(clientCreated, false);
});

test('rejects market orders', () => {
    assert.throws(
        () =>
            submitSandboxLimitOrder({
                ...validOrder,
                orderType: 'MARKET',
            }),
        /Only LIMIT orders/,
    );
});

test('rejects a client that is not configured for Sandbox', () => {
    assert.throws(
        () =>
            submitSandboxLimitOrder(validOrder, {
                clientFactory: () => ({
                    sandbox: false,
                    basePath: 'https://api.upstox.com',
                    orderBasePath: 'https://api-hft.upstox.com',
                }),
            }),
        /requires Upstox Sandbox mode/,
    );
});

test('returns the order ID from a mocked successful response', async () => {
    let capturedRequest;

    const result = await submitSandboxLimitOrder(validOrder, {
        clientFactory: sandboxClient,
        orderApiFactory: () => ({
            placeOrder: (request, options, callback) => {
                capturedRequest = request;
                callback(null, {
                    status: 'success',
                    data: { orderIds: ['mock-sandbox-order-123'] },
                });
            },
        }),
    });

    assert.deepEqual(result, {
        status: 'success',
        orderIds: ['mock-sandbox-order-123'],
    });
    assert.equal(capturedRequest.orderType, 'LIMIT');
    assert.equal(capturedRequest.product, 'I');
    assert.equal(capturedRequest.transactionType, 'BUY');
});

test('reports a failed Sandbox submission without exposing details', async () => {
    await assert.rejects(
        submitSandboxLimitOrder(validOrder, {
            clientFactory: sandboxClient,
            orderApiFactory: () =>
                mockOrderApi([new Error('Simulated API failure'), null]),
        }),
        /Sandbox order submission failed/,
    );
});

test('rejects delivery product when intraday is required', () => {
    assert.throws(
        () =>
            submitSandboxLimitOrder({
                ...validOrder,
                product: 'D',
            }),
        /intraday product I/,
    );

    test('rejects delivery product when intraday is required', () => {
        assert.throws(
            () =>
                submitSandboxLimitOrder({
                    ...validOrder,
                    product: 'D',
                }),
            /intraday product I/,
        );
    });
});
