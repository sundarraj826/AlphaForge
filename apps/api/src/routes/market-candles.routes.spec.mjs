
import test from 'node:test';
import assert from 'node:assert/strict';

import { createApiServer } from '../server.mjs';

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
