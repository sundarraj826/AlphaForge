import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createApiServer } from '../server.mjs';
import { createOrderIntentStore } from '../storage/order-intent.store.mjs';
import { handleMarketCandles } from './market-candles.routes.mjs';

function createTestServer(t) {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-market-test-'),
    );
    const store = createOrderIntentStore({
        databasePath: path.join(
            temporaryDirectory,
            'order-intents.sqlite',
        ),
    });
    const server = createApiServer({ orderIntentStore: store });

    t.after(() => new Promise(resolve => {
        server.close(() => {
            store.close();
            rmSync(temporaryDirectory, { recursive: true, force: true });
            resolve();
        });
    }));

    return server;
}

test('GET /api/market/candles returns three mock candles', async (t) => {
    const server = createTestServer(t);

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/market/candles`);

    assert.equal(response.status, 200);

    const body = await response.json();

    assert.equal(body.status, 'success');
    assert.equal(body.source, 'mock');
    assert.equal(body.data.candles.length, 3);

    assert.deepEqual(Object.keys(body.data.candles[0]).sort(), ['close', 'high', 'low', 'open', 'timestamp', 'volume']);
});

test('GET /api/market/candles returns valid OHLC values', async (t) => {
    const server = createTestServer(t);

    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/market/candles`);

    const body = await response.json();

    for (const candle of body.data.candles) {
        assert.ok(candle.high >= candle.low);
        assert.ok(candle.high >= Math.max(candle.open, candle.close));
        assert.ok(candle.low <= Math.min(candle.open, candle.close));
        assert.ok(candle.volume >= 0);
    }
});

for (const [timeframe, unit, interval] of [
    ['1m', 'minutes', 1],
    ['5m', 'minutes', 5],
    ['15m', 'minutes', 15],
    ['1H', 'hours', 1],
    ['4H', 'hours', 4],
    ['1D', 'days', 1],
]) {
    test(`maps ${timeframe} to its explicit Upstox V3 interval`, async () => {
        let providerOptions;
        let statusCode;
        let responseBody;

        await handleMarketCandles(
            {
                url: `/api/market/candles?source=upstox&instrument=NIFTY50&timeframe=${timeframe}&fromDate=2026-10-23&toDate=2026-10-23`,
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
            unit,
            interval,
            fromDate: '2026-10-23',
            toDate: '2026-10-23',
        });
        assert.deepEqual(responseBody.data.candles, []);
    });
}

test('rejects unsupported historical instruments without calling the provider', async () => {
    let statusCode;
    let responseBody;
    let providerCalled = false;

    await handleMarketCandles(
        {
            url: '/api/market/candles?source=upstox&instrument=XAU%2FUSD&timeframe=15m&fromDate=2026-10-23&toDate=2026-10-23',
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

for (const timeframe of [undefined, '2m']) {
    test(`rejects ${timeframe ?? 'a missing'} historical timeframe without calling the provider`, async () => {
        let statusCode;
        let responseBody;
        let providerCalled = false;
        const timeframeParameter = timeframe ? `&timeframe=${timeframe}` : '';

        await handleMarketCandles(
            {
                url: `/api/market/candles?source=upstox&instrument=NIFTY50${timeframeParameter}&fromDate=2026-10-23&toDate=2026-10-23`,
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
        assert.match(responseBody.message, /supported timeframe/i);
        assert.equal(providerCalled, false);
    });
}

test('rejects a historical date range beyond the timeframe limit without truncating it', async () => {
    let statusCode;
    let responseBody;
    let providerCalled = false;

    await handleMarketCandles(
        {
            url: '/api/market/candles?source=upstox&instrument=NIFTY50&timeframe=15m&fromDate=2026-09-22&toDate=2026-10-23',
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
    assert.match(responseBody.message, /up to 1 month/i);
    assert.equal(providerCalled, false);
});

for (const [timeframe, earliestDate, dayBefore] of [
    ['1m', '2022-01-01', '2021-12-31'],
    ['1H', '2022-01-01', '2021-12-31'],
    ['1D', '2000-01-01', '1999-12-31'],
]) {
    test(`allows ${timeframe} history beginning on ${earliestDate}`, async () => {
        let statusCode;
        let providerCalled = false;

        await handleMarketCandles(
            {
                url: `/api/market/candles?source=upstox&instrument=NIFTY50&timeframe=${timeframe}&fromDate=${earliestDate}&toDate=${earliestDate}`,
            },
            {
                writeHead: (status) => {
                    statusCode = status;
                },
                end: () => {},
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

        assert.equal(statusCode, 200);
        assert.equal(providerCalled, true);
    });

    test(`rejects ${timeframe} history beginning before ${earliestDate}`, async () => {
        let statusCode;
        let responseBody;
        let providerCalled = false;

        await handleMarketCandles(
            {
                url: `/api/market/candles?source=upstox&instrument=NIFTY50&timeframe=${timeframe}&fromDate=${dayBefore}&toDate=${dayBefore}`,
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
        assert.match(responseBody.message, new RegExp(earliestDate));
        assert.equal(providerCalled, false);
    });
}
