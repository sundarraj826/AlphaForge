import test from 'node:test';
import assert from 'node:assert/strict';

import { UpstoxHistoricalCandleProvider } from './upstox-historical-candle-provider.mjs';

test('fails closed without making a network request when Sandbox candles are unverified', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error('Network access must not occur in this test.');
    };

    try {
        const provider = new UpstoxHistoricalCandleProvider();
        await assert.rejects(
            provider.getHistoricalCandles({
                instrumentKey: 'NSE_INDEX|Nifty 50',
                unit: 'minutes',
                interval: 15,
                fromDate: '2026-10-01',
                toDate: '2026-10-02',
            }),
            /no Sandbox endpoint is verified/,
        );
        assert.equal(fetchCalled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
