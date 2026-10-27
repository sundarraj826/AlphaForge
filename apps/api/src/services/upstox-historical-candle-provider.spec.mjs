import test from 'node:test';
import assert from 'node:assert/strict';

import { UpstoxHistoricalCandleProvider } from './upstox-historical-candle-provider.mjs';

test('rejects requests when the market-data token is missing', async () => {
    const originalToken = process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN;
    delete process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN;

    try {
        const provider = new UpstoxHistoricalCandleProvider();

        await assert.rejects(
            provider.getHistoricalCandles({
                instrumentKey: 'NSE_INDEX|Nifty 50',
                unit: 'minutes',
                interval: 5,
                fromDate: '2026-10-01',
                toDate: '2026-10-02',
            }),
            /access token is not configured/,
        );
    } finally {
        if (originalToken === undefined) {
            delete process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN;
        } else {
            process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN = originalToken;
        }
    }
});

test('rejects invalid date ranges before making a request', async () => {
    const provider = new UpstoxHistoricalCandleProvider();

    await assert.rejects(
        provider.getHistoricalCandles({
            instrumentKey: 'NSE_INDEX|Nifty 50',
            unit: 'minutes',
            interval: 5,
            fromDate: '2026-10-10',
            toDate: '2026-10-01',
        }),
        /Invalid historical candle date range/,
    );
});

test('requires an explicit instrument key instead of using a fallback', async () => {
    const provider = new UpstoxHistoricalCandleProvider();

    await assert.rejects(
        provider.getHistoricalCandles({
            fromDate: '2026-10-23',
            toDate: '2026-10-23',
        }),
        /A supported instrument key is required/,
    );
});

for (const [unit, interval] of [
    ['minutes', 1],
    ['minutes', 5],
    ['minutes', 15],
    ['hours', 1],
    ['hours', 4],
    ['days', 1],
]) {
    test(`fetches historical candles using ${unit}/${interval}`, async () => {
        const originalToken = process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN;
        const originalFetch = globalThis.fetch;

        process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN = 'test-analytics-token';

        const capturedUrls = [];
        let capturedAuthorization;

        globalThis.fetch = async (url, options) => {
            capturedUrls.push(String(url));
            capturedAuthorization = options.headers.Authorization;

            return {
                ok: true,
                status: 200,
                json: async () => ({
                    status: 'success',
                    data: {
                        candles: [
                            ['2026-10-23T09:15:00+05:30', 100, 105, 98, 103, 1200, 0],
                            ['2026-10-23T09:20:00+05:30', 103, 108, 101, 106, 1500, 0],
                        ],
                    },
                }),
            };
        };

        try {
            const provider = new UpstoxHistoricalCandleProvider();

            const candles = await provider.getHistoricalCandles({
                instrumentKey: 'NSE_INDEX|Nifty 50',
                unit,
                interval,
                fromDate: '2026-10-23',
                toDate: '2026-10-23',
            });

            assert.equal(
                capturedUrls[0],
                'https://api.upstox.com/v3/historical-candle/' +
                    `NSE_INDEX%7CNifty%2050/${unit}/${interval}/2026-10-23/2026-10-23`,
            );

            assert.equal(capturedAuthorization, 'Bearer test-analytics-token');

            assert.equal(candles.length, 2);
            assert.equal(candles[0].open, 100);
            assert.equal(candles[0].high, 105);
            assert.equal(candles[0].low, 98);
            assert.equal(candles[0].close, 103);
            assert.equal(candles[0].volume, 1200);
        } finally {
            globalThis.fetch = originalFetch;

            if (originalToken === undefined) {
                delete process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN;
            } else {
                process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN = originalToken;
            }
        }
    });
}

test('rejects missing or unsupported Upstox V3 candle intervals', async () => {
    const provider = new UpstoxHistoricalCandleProvider();

    for (const interval of [
        { unit: undefined, interval: undefined },
        { unit: 'minutes', interval: 2 },
        { unit: 'hours', interval: 15 },
    ]) {
        await assert.rejects(
            provider.getHistoricalCandles({
                instrumentKey: 'NSE_INDEX|Nifty 50',
                ...interval,
                fromDate: '2026-10-23',
                toDate: '2026-10-23',
            }),
            /supported Upstox V3 candle unit and interval/,
        );
    }
});
