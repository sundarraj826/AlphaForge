
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MarketCandleProvider,
    MockMarketCandleProvider,
} from './market-candle-provider.mjs';

test('base provider rejects unimplemented historical data access', async () => {
    const provider = new MarketCandleProvider();

    await assert.rejects(
        provider.getHistoricalCandles(),
        /not configured/,
    );
});

test('mock provider returns three standardized candles', async () => {
    const provider = new MockMarketCandleProvider();
    const candles = await provider.getHistoricalCandles();

    assert.equal(candles.length, 3);
    assert.equal(candles[0].open, 100);
    assert.equal(candles[1].close, 106);
    assert.equal(candles[2].volume, 1350);
});

test('mock provider returns valid OHLC candle values', async () => {
    const provider = new MockMarketCandleProvider();
    const candles = await provider.getHistoricalCandles();

    for (const candle of candles) {
        assert.ok(candle.high >= candle.low);
        assert.ok(candle.high >= Math.max(candle.open, candle.close));
        assert.ok(candle.low <= Math.min(candle.open, candle.close));
        assert.ok(candle.volume >= 0);
    }
});
