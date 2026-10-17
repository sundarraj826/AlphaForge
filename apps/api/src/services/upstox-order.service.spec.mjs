
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSandboxOrderDetails } from './upstox-order.service.mjs';

function mockResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    };
}

test('retrieves order details through the Sandbox host', async () => {
    let requestedUrl;
    let requestedOptions;

    const mockFetch = async (url, options) => {
        requestedUrl = url;
        requestedOptions = options;

        return mockResponse({
            status: 'success',
            data: {
                order_id: 'sandbox-test-123',
                status: 'open pending',
                quantity: 1,
                filled_quantity: 0,
            },
        });
    };

    const order = await getSandboxOrderDetails(
        'sandbox-test-123',
        mockFetch,
    );

    assert.equal(order.order_id, 'sandbox-test-123');
    assert.equal(order.status, 'open pending');
    assert.equal(requestedUrl.origin, 'https://api-sandbox.upstox.com');
    assert.equal(requestedUrl.pathname, '/v2/order/details');
    assert.equal(
        requestedUrl.searchParams.get('order_id'),
        'sandbox-test-123',
    );
    assert.equal(requestedOptions.method, 'GET');
    assert.match(requestedOptions.headers.Authorization, /^Bearer /);
});

test('rejects an empty order ID without making a request', async () => {
    let requestCalled = false;

    await assert.rejects(
        getSandboxOrderDetails('  ', async () => {
            requestCalled = true;
        }),
        /valid Sandbox order ID/,
    );

    assert.equal(requestCalled, false);
});

test('reports an order-not-found response', async () => {
    const mockFetch = async () =>
        mockResponse(
            {
                status: 'error',
                errors: [
                    {
                        errorCode: 'UDAPI100010',
                        message: 'Order not found',
                    },
                ],
            },
            404,
        );

    await assert.rejects(
        getSandboxOrderDetails('missing-order', mockFetch),
        /HTTP 404.*UDAPI100010.*Order not found/,
    );
});

test('rejects a response for a different order ID', async () => {
    const mockFetch = async () =>
        mockResponse({
            status: 'success',
            data: { order_id: 'different-order' },
        });

    await assert.rejects(
        getSandboxOrderDetails('requested-order', mockFetch),
        /did not match the requested order ID/,
    );
});

test('propagates network and timeout errors', async () => {
    const mockFetch = async () => {
        throw new Error('Simulated network timeout');
    };

    await assert.rejects(
        getSandboxOrderDetails('sandbox-test-123', mockFetch),
        /Simulated network timeout/,
    );
});

test('rejects invalid JSON responses', async () => {
    const mockFetch = async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw new Error('Invalid JSON');
        },
    });

    await assert.rejects(
        getSandboxOrderDetails('sandbox-test-123', mockFetch),
        /invalid JSON/,
    );
});
