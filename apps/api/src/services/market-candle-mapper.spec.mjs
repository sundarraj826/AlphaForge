
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    mapHistoricalCandleResponse,
} from './market-candle-mapper.mjs';

import {
    mapHistoricalCandle,
    mapHistoricalCandles,
} from './market-candle-mapper.mjs';

test('maps a valid candle into MarketCandle format', () => {
    const result = mapHistoricalCandle([
        '2026-10-23T09:15:00+05:30',
        100,
        105,
        98,
        103,
        1200,
    ]);

    assert.deepEqual(result, {
        timestamp: Date.parse('2026-10-23T09:15:00+05:30'),
        open: 100,
        high: 105,
        low: 98,
        close: 103,
        volume: 1200,
    });
});

test('maps multiple candles', () => {
    const result = mapHistoricalCandles([
        ['2026-10-23T09:15:00+05:30', 100, 105, 98, 103, 1200],
        ['2026-10-23T09:20:00+05:30', 103, 108, 101, 106, 1500],
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[1].close, 106);
});

test('rejects a malformed candle', () => {
    assert.throws(
        () => mapHistoricalCandle(['invalid']),
        /Invalid historical candle format/,
    );
});

test('rejects inconsistent OHLC values', () => {
    assert.throws(
        () =>
            mapHistoricalCandle([
                '2026-10-23T09:15:00+05:30',
                100,
                99,
                98,
                103,
                1200,
            ]),
        /inconsistent/,
    );
});

test('rejects a negative volume', () => {
    assert.throws(
        () =>
            mapHistoricalCandle([
                '2026-10-23T09:15:00+05:30',
                100,
                105,
                98,
                103,
                -1,
            ]),
        /inconsistent/,
    );
});


test('maps the Upstox historical candle response', () => {
    const response = {
        status: 'success',
        data: {
            candles: [
                ['2026-10-23T09:15:00+05:30', 100, 105, 98, 103, 1200, 0],
            ],
        },
    };

    const result = mapHistoricalCandleResponse(response);

    assert.equal(result.length, 1);
    assert.equal(result[0].open, 100);
    assert.equal(result[0].close, 103);
    assert.equal(result[0].volume, 1200);
});

