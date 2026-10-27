
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ConfirmedSandboxOrderRejectionError,
    submitSandboxLimitOrder,
    UnknownSandboxOrderOutcomeError,
} from './upstox-order-submit.service.mjs';
import { validateSandboxLimitOrder } from '../config/order-risk.config.mjs';

const riskConfig = {
    allowedInstruments: ['NSE_EQ|INE669E01016'],
    maxQuantity: 10,
    maxNotional: '1000',
};

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

function withRiskConfiguration(callback, config = riskConfig) {
    const names = [
        'UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS',
        'UPSTOX_SANDBOX_MAX_ORDER_QUANTITY',
        'UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL',
    ];
    const originalValues = new Map(
        names.map(name => [name, process.env[name]]),
    );

    process.env.UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS =
        config.allowedInstruments.join(',');
    process.env.UPSTOX_SANDBOX_MAX_ORDER_QUANTITY =
        String(config.maxQuantity);
    process.env.UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL =
        String(config.maxNotional);

    try {
        return callback();
    } finally {
        for (const [name, value] of originalValues) {
            if (value === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = value;
            }
        }
    }
}

function submit(order, options = {}) {
    return withRiskConfiguration(
        () => submitSandboxLimitOrder(order, options),
    );
}

test('rejects invalid quantity before creating a client', async () => {
    let clientCreated = false;

    assert.throws(
        () =>
            submit(
                { ...validOrder, quantity: 0 },
                {
                    clientFactory: () => {
                        clientCreated = true;
                        return sandboxClient();
                    },
                    orderApiFactory: () => mockOrderApi([null, {}]),
                },
            ),
        /positive safe integer/,
    );

    assert.equal(clientCreated, false);
});

test('rejects market orders', () => {
    assert.throws(
        () =>
            submit({
                ...validOrder,
                orderType: 'MARKET',
            }),
        /Only LIMIT orders/,
    );
});

test('rejects a client that is not configured for Sandbox', () => {
    assert.throws(
        () =>
            submit(validOrder, {
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

    const result = await submit(validOrder, {
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

test('rejects malformed or unusable order IDs as an unknown outcome', async () => {
    for (const orderIds of [
        [null],
        [''],
        [' \t\n '],
        [{}],
        ['valid-order-id', null],
        ['valid-order-id', '   '],
        ['valid-order-id', {}],
    ]) {
        await assert.rejects(
            submit(validOrder, {
                clientFactory: sandboxClient,
                orderApiFactory: () => mockOrderApi([
                    null,
                    { status: 'success', data: { orderIds } },
                ]),
            }),
            UnknownSandboxOrderOutcomeError,
            `expected ${JSON.stringify(orderIds)} to be ambiguous`,
        );
    }
});

test('trims usable order IDs from a successful provider response', async () => {
    const result = await submit(validOrder, {
        clientFactory: sandboxClient,
        orderApiFactory: () => mockOrderApi([
            null,
            {
                status: 'success',
                data: { orderIds: ['  sandbox-order-id  '] },
            },
        ]),
    });

    assert.deepEqual(result.orderIds, ['sandbox-order-id']);
});

test('reports a failed Sandbox submission without exposing details', async () => {
    await assert.rejects(
        submit(validOrder, {
            clientFactory: sandboxClient,
            orderApiFactory: () =>
                mockOrderApi([new Error('Simulated API failure'), null]),
        }),
        UnknownSandboxOrderOutcomeError,
    );
});

test('distinguishes confirmed Sandbox rejection from ambiguous responses', async () => {
    await assert.rejects(
        submit(validOrder, {
            clientFactory: sandboxClient,
            orderApiFactory: () => mockOrderApi([
                null,
                {
                    status: 'error',
                    errors: [{ errorCode: 'MOCK_REJECTED' }],
                },
            ]),
        }),
        ConfirmedSandboxOrderRejectionError,
    );

    await assert.rejects(
        submit(validOrder, {
            clientFactory: sandboxClient,
            orderApiFactory: () =>
                mockOrderApi([new Error('connection lost'), null]),
        }),
        UnknownSandboxOrderOutcomeError,
    );

    await assert.rejects(
        submit(validOrder, {
            clientFactory: sandboxClient,
            orderApiFactory: () =>
                mockOrderApi([null, { status: 'unexpected' }]),
        }),
        UnknownSandboxOrderOutcomeError,
    );
});

test('marks a provider callback timeout as an unknown outcome', async () => {
    await assert.rejects(
        submit(validOrder, {
            clientFactory: sandboxClient,
            orderApiFactory: () => ({
                placeOrder: () => {},
            }),
            submissionTimeoutMs: 5,
        }),
        UnknownSandboxOrderOutcomeError,
    );
});

test('rejects delivery product when intraday is required', () => {
    assert.throws(
        () =>
            submit({
                ...validOrder,
                product: 'D',
            }),
        /intraday product I/,
    );

    test('rejects delivery product when intraday is required', () => {
        assert.throws(
            () =>
                submit({
                    ...validOrder,
                    product: 'D',
                }),
            /intraday product I/,
        );
    });
});

test('allows an approved order exactly at quantity and notional limits', async () => {
    let capturedRequest;
    const order = {
        ...validOrder,
        quantity: 10,
        price: 100,
    };

    const validatedOrder = validateSandboxLimitOrder(order, riskConfig);
    const result = await submit(order, {
        clientFactory: sandboxClient,
        orderApiFactory: () => ({
            placeOrder: (request, options, callback) => {
                capturedRequest = request;
                callback(null, {
                    status: 'success',
                    data: { orderIds: ['mock-boundary-order'] },
                });
            },
        }),
    });

    assert.equal(validatedOrder.quantity, 10);
    assert.equal(capturedRequest.price * capturedRequest.quantity, 1000);
    assert.deepEqual(result.orderIds, ['mock-boundary-order']);
});

test('uses exact decimal arithmetic at the notional boundary', () => {
    const decimalRiskConfig = {
        allowedInstruments: [validOrder.instrumentToken],
        maxQuantity: 3,
        maxNotional: '0.3',
    };

    assert.doesNotThrow(() => validateSandboxLimitOrder(
        { ...validOrder, quantity: 3, price: 0.1 },
        decimalRiskConfig,
    ));

    assert.throws(
        () => validateSandboxLimitOrder(
            { ...validOrder, quantity: 3, price: 0.100001 },
            decimalRiskConfig,
        ),
        /notional exceeds/,
    );
});

test('supports fractional and large valid decimal prices within the configured precision', () => {
    assert.doesNotThrow(() => validateSandboxLimitOrder(
        { ...validOrder, quantity: 3, price: 0.123456 },
        {
            allowedInstruments: [validOrder.instrumentToken],
            maxQuantity: 3,
            maxNotional: '0.370368',
        },
    ));

    assert.doesNotThrow(() => validateSandboxLimitOrder(
        { ...validOrder, quantity: 1, price: 999999999999999 },
        {
            allowedInstruments: [validOrder.instrumentToken],
            maxQuantity: 1,
            maxNotional: '999999999999999',
        },
    ));
});

test('rejects prices outside the supported decimal precision and range', () => {
    for (const price of [
        0.0000001,
        1000000000000000,
        1e21,
    ]) {
        assert.throws(
            () => validateSandboxLimitOrder(
                { ...validOrder, price },
                riskConfig,
            ),
            /at most six fractional digits and fifteen integer digits/,
        );
    }
});

test('rejects an instrument outside the configured allowlist before creating a client', () => {
        let clientCreated = false;

        assert.throws(
            () => submit(
                { ...validOrder, instrumentToken: 'NSE_EQ|NOT_APPROVED' },
                {
                    clientFactory: () => {
                        clientCreated = true;
                        return sandboxClient();
                    },
                },
            ),
            /not approved/,
        );
        assert.equal(clientCreated, false);
});

test('rejects quantity above the configured maximum', () => {
        assert.throws(
            () => submit({ ...validOrder, quantity: riskConfig.maxQuantity + 1 }),
            /quantity exceeds/,
        );
});

test('rejects notional above the configured maximum', () => {
        assert.throws(
            () => submit({ ...validOrder, quantity: 2, price: 501 }),
            /notional exceeds/,
        );
});

test('rejects unsafe quantities and non-finite or invalid limit prices', () => {
        for (const order of [
            { ...validOrder, quantity: Number.MAX_SAFE_INTEGER + 1 },
            { ...validOrder, price: Number.NaN },
            { ...validOrder, price: Number.POSITIVE_INFINITY },
            { ...validOrder, price: 0 },
            { ...validOrder, price: -1 },
        ]) {
            assert.throws(
                () => submit(order),
                /quantity|price/i,
            );
        }
});

test('rejects a price outside the supported numeric range', () => {
        assert.throws(
            () => validateSandboxLimitOrder(
                { ...validOrder, quantity: Number.MAX_SAFE_INTEGER, price: Number.MAX_VALUE },
                {
                    allowedInstruments: [validOrder.instrumentToken],
                    maxQuantity: Number.MAX_SAFE_INTEGER,
                    maxNotional: '999999999999999',
                },
            ),
            /fifteen integer digits/,
        );
});

test('direct service callers cannot override the authoritative risk configuration', () => {
    let clientCreated = false;
    const permissiveInjectedRiskConfig = {
        allowedInstruments: ['NSE_EQ|INE669E01016', 'NSE_EQ|NOT_APPROVED'],
        maxQuantity: 100000,
        maxNotional: '999999999999999',
    };

    withRiskConfiguration(() => {
        for (const order of [
            { ...validOrder, instrumentToken: 'NSE_EQ|NOT_APPROVED' },
            { ...validOrder, quantity: riskConfig.maxQuantity + 1 },
            { ...validOrder, quantity: 2, price: 501 },
        ]) {
            assert.throws(
                () => submitSandboxLimitOrder(order, {
                    riskConfig: permissiveInjectedRiskConfig,
                    clientFactory: () => {
                        clientCreated = true;
                        return sandboxClient();
                    },
                }),
                /not approved|quantity exceeds|notional exceeds/,
            );
        }
    });

    assert.equal(clientCreated, false);
});

test('direct service callers cannot change order values between validation and submission', async () => {
    let clientCreated = false;
    let quantityReads = 0;
    let capturedRequest;
    const changingOrder = {
        ...validOrder,
        get quantity() {
            quantityReads++;
            return quantityReads === 1 ? 1 : riskConfig.maxQuantity + 1;
        },
    };

    const result = withRiskConfiguration(
        () => submitSandboxLimitOrder(changingOrder, {
                clientFactory: () => {
                    clientCreated = true;
                    return sandboxClient();
                },
                orderApiFactory: () => ({
                    placeOrder: (request, options, callback) => {
                        capturedRequest = request;
                        callback(null, {
                            status: 'success',
                            data: { orderIds: ['mock-snapshot-order'] },
                        });
                    },
                }),
            }),
    );

    await result;
    assert.equal(clientCreated, true);
    assert.equal(quantityReads, 1);
    assert.equal(capturedRequest.quantity, 1);
});

test('fails closed without risk configuration before creating a client', () => {
    let clientCreated = false;
    const names = [
        'UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS',
        'UPSTOX_SANDBOX_MAX_ORDER_QUANTITY',
        'UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL',
    ];
    const originalValues = new Map(names.map(name => [name, process.env[name]]));

    for (const name of names) {
        delete process.env[name];
    }

    try {
        assert.throws(
            () => submitSandboxLimitOrder(validOrder, {
                clientFactory: () => {
                    clientCreated = true;
                    return sandboxClient();
                },
            }),
            /risk configuration is missing or invalid/,
        );
    } finally {
        for (const [name, value] of originalValues) {
            if (value !== undefined) {
                process.env[name] = value;
            }
        }
    }

    assert.equal(clientCreated, false);
});
