
import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiServer } from '../server.mjs';
import { handleMarketCandles } from './market-candles.routes.mjs';

test('GET /api/market/candles returns three mock candles', async (t) => {
    const server = createApiServer();

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    t.after(() => {
        server.close();
    });

    const address = server.address();
    const response = await fetch(
        `http://127.0.0.1:${address.port}/api/market/candles`,
    );

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.status, 'success');
    assert.equal(body.source, 'mock');
    assert.equal(body.data.candles.length, 3);

    assert.deepEqual(
        Object.keys(body.data.candles[0]).sort(),
        ['close', 'high', 'low', 'open', 'timestamp', 'volume'],
    );
});

test('GET /api/market/candles returns valid OHLC values', async (t) => {
    const server = createApiServer();

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    t.after(() => {
        server.close();
    });

    const address = server.address();
    const response = await fetch(
        `http://127.0.0.1:${address.port}/api/market/candles`,
    );

    const body = await response.json();

    for (const candle of body.data.candles) {
        assert.ok(candle.high >= candle.low);
        assert.ok(candle.high >= Math.max(candle.open, candle.close));
        assert.ok(candle.low <= Math.min(candle.open, candle.close));
        assert.ok(candle.volume >= 0);
    }
});

test('forwards the verified NIFTY50 instrument key to the historical provider', async () => {
    let providerOptions;
    let statusCode;
    let responseBody;

    await handleMarketCandles(
        {
            url: '/api/market/candles?source=upstox&instrument=NIFTY50&fromDate=2026-10-23&toDate=2026-10-23',
        },
        {
            writeHead: (status) => {
                statusCode = status;
            },
            end: (body) => {
                responseBody = JSON.parse(body);
            },
        },
        {
            historicalProvider: {
                getHistoricalCandles: async (options) => {
                    providerOptions = options;
                    return [];
                },
            },
        },
    );

    assert.equal(statusCode, 200);
    assert.deepEqual(providerOptions, {
        instrumentKey: 'NSE_INDEX|Nifty 50',
        interval: 5,
        fromDate: '2026-10-23',
        toDate: '2026-10-23',
    });
    assert.deepEqual(responseBody.data.candles, []);
});

test('rejects unsupported historical instruments without calling the provider', async () => {
    let statusCode;
    let responseBody;
    let providerCalled = false;

    await handleMarketCandles(
        {
            url: '/api/market/candles?source=upstox&instrument=XAU%2FUSD&fromDate=2026-10-23&toDate=2026-10-23',
        },
        {
            writeHead: (status) => {
                statusCode = status;
            },
            end: (body) => {
                responseBody = JSON.parse(body);
            },
        },
        {
            historicalProvider: {
                getHistoricalCandles: async () => {
                    providerCalled = true;
                    return [];
                },
            },
        },
    );

    assert.equal(statusCode, 400);
    assert.equal(responseBody.message, 'Unsupported historical instrument.');
    assert.equal(providerCalled, false);
});
