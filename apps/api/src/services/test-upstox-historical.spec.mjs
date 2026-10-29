import test from 'node:test';
import assert from 'node:assert/strict';

import { runHistoricalCandleProbe } from './test-upstox-historical.mjs';

test('manual historical-candle probe is disabled without a Sandbox endpoint', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
        fetchCalled = true;
        throw new Error('Network access must not occur in this test.');
    };

    try {
        assert.throws(
            runHistoricalCandleProbe,
            /no Sandbox endpoint is verified/,
        );
        assert.equal(fetchCalled, false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
