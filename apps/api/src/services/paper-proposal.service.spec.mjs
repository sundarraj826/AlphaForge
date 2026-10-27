import assert from 'node:assert/strict';
import test from 'node:test';

import {
    NIFTY50_PAPER_STRATEGY_CONFIG,
} from '../config/nifty50-paper-strategy.config.mjs';
import {
    generatePaperProposal,
    PaperProposalError,
} from './paper-proposal.service.mjs';

const CANDLE_DURATION_MS = 15 * 60_000;
const FINALIZATION_DELAY_MS =
    NIFTY50_PAPER_STRATEGY_CONFIG.evaluation.finalizationDelayMs;
const START_TIME = Date.parse('2026-10-27T09:15:00+05:30');
const candles = Array.from({ length: 50 }, (_, index) => {
    const close = 100 + index;
    return {
        timestamp: START_TIME + index * CANDLE_DURATION_MS,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000,
    };
});
candles[candles.length - 1] = {
    ...candles[candles.length - 1],
    open: 148.5,
    high: 151,
    low: 148,
    close: 150,
    volume: 1500,
};

const calendarPolicy = {
    getCandleEndTime: ({ candleStartTime, nominalDurationMs }) =>
        candleStartTime + nominalDurationMs,
};
const evaluationTime =
    candles[candles.length - 1].timestamp +
    CANDLE_DURATION_MS +
    FINALIZATION_DELAY_MS;

function evaluationTimeFor(inputCandles) {
    return (
        inputCandles[inputCandles.length - 1].timestamp +
        CANDLE_DURATION_MS +
        FINALIZATION_DELAY_MS
    );
}

function generate(
    inputCandles = candles,
    configuration = NIFTY50_PAPER_STRATEGY_CONFIG,
    now = evaluationTimeFor(inputCandles),
    policy = calendarPolicy,
) {
    return generatePaperProposal({
        candles: inputCandles,
        clock: () => now,
        calendarPolicy: policy,
        configuration,
    });
}

function createCandles(closes, volumes = []) {
    return closes.map((close, index) => {
        const open = close - 0.5;
        return {
            timestamp: START_TIME + index * CANDLE_DURATION_MS,
            open,
            high: Math.max(open, close) + 1,
            low: Math.min(open, close) - 1,
            close,
            volume: volumes[index] ?? 1000,
        };
    });
}

function configurationFor(parameters) {
    return {
        ...NIFTY50_PAPER_STRATEGY_CONFIG,
        parameters: {
            ...NIFTY50_PAPER_STRATEGY_CONFIG.parameters,
            ...parameters,
        },
        evaluation: {
            ...NIFTY50_PAPER_STRATEGY_CONFIG.evaluation,
            minimumHistory: Math.max(
                parameters.emaSlowPeriod,
                parameters.volumePeriod + 1,
            ),
        },
    };
}

function angularLatestEma(inputCandles, period) {
    const prices = inputCandles.map(candle => candle.close);
    if (prices.length < period) {
        return null;
    }

    const multiplier = 2 / (period + 1);
    let ema =
        prices.slice(0, period).reduce((sum, price) => sum + price, 0) /
        period;

    for (let index = period; index < prices.length; index += 1) {
        ema = (prices[index] - ema) * multiplier + ema;
    }

    return ema;
}

function firstPriceSeededEma(inputCandles, period) {
    const prices = inputCandles.map(candle => candle.close);
    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let index = 1; index < prices.length; index += 1) {
        ema = (prices[index] - ema) * multiplier + ema;
    }

    return ema;
}

test('creates a paper-only NIFTY50 BUY proposal for a valid signal', () => {
    const proposal = generate();

    assert.equal(proposal.status, 'PAPER_PROPOSAL');
    assert.equal(proposal.strategyId, 'nifty50-intraday-trend');
    assert.equal(proposal.strategyVersion, 1);
    assert.equal(proposal.instrument, 'NIFTY50');
    assert.equal(proposal.timeframe, '15m');
    assert.equal(proposal.side, 'BUY');
    assert.equal(proposal.signalTimestamp, candles.at(-1).timestamp);
    assert.equal(proposal.referencePrice, candles.at(-1).close);
    assert.deepEqual(proposal.execution, {
        status: 'UNAVAILABLE',
        orderableInstrumentToken: null,
        quantity: null,
        limitPrice: null,
        riskCheck: 'NOT_EVALUATED',
        reason:
            'Orderable instrument mapping and server-controlled sizing are not verified.',
    });
});

test('uses the Angular SMA-seeded recursive EMA calculation', () => {
    const closes = Array.from({ length: 49 }, (_, index) => 100 + index);
    const prefix = createCandles(closes);
    const angularFastEma = angularLatestEma(prefix, 20);
    const firstPriceSeededFastEma = firstPriceSeededEma(prefix, 20);
    const currentClose = (angularFastEma + firstPriceSeededFastEma) / 2;
    const fixture = createCandles([...closes, currentClose]);
    fixture[fixture.length - 1].volume = 1500;

    assert.ok(currentClose > angularFastEma);
    assert.ok(currentClose < firstPriceSeededFastEma);
    assert.ok(
        angularLatestEma(fixture, 20) >
            angularLatestEma(fixture, 50),
    );
    assert.equal(generate(fixture).side, 'BUY');
});

test('requires fast EMA to be strictly greater than slow EMA', () => {
    const fixture = createCandles([100, 100, 88, 104], [
        1000,
        1000,
        1000,
        1200,
    ]);
    const config = configurationFor({
        emaFastPeriod: 2,
        emaSlowPeriod: 3,
        volumePeriod: 2,
        volumeMultiplier: 1.2,
    });

    assert.equal(angularLatestEma(fixture, 2), angularLatestEma(fixture, 3));
    assert.ok(fixture.at(-1).close > angularLatestEma(fixture, 2));
    assert.equal(generate(fixture, config).status, 'NO_SIGNAL');
});

test('requires the latest close to be strictly greater than fast EMA', () => {
    const prefix = createCandles([100, 100, 110]);
    const currentClose = angularLatestEma(prefix, 2);
    const fixture = [
        ...prefix,
        {
            ...createCandles([currentClose])[0],
            timestamp: prefix.at(-1).timestamp + CANDLE_DURATION_MS,
            volume: 1200,
        },
    ];
    const config = configurationFor({
        emaFastPeriod: 2,
        emaSlowPeriod: 3,
        volumePeriod: 2,
        volumeMultiplier: 1.2,
    });

    assert.ok(angularLatestEma(fixture, 2) > angularLatestEma(fixture, 3));
    assert.equal(fixture.at(-1).close, angularLatestEma(fixture, 2));
    assert.equal(generate(fixture, config).status, 'NO_SIGNAL');
});

test('requires a bullish candle to have close strictly greater than open', () => {
    const fixture = createCandles(
        [100, 100, 110, 108],
        [1000, 1000, 1000, 1200],
    );
    fixture.at(-1).open = fixture.at(-1).close;
    fixture.at(-1).high = fixture.at(-1).close + 1;
    fixture.at(-1).low = fixture.at(-1).close - 1;
    const config = configurationFor({
        emaFastPeriod: 2,
        emaSlowPeriod: 3,
        volumePeriod: 2,
        volumeMultiplier: 1.2,
    });

    assert.ok(angularLatestEma(fixture, 2) > angularLatestEma(fixture, 3));
    assert.ok(fixture.at(-1).close > angularLatestEma(fixture, 2));
    assert.equal(fixture.at(-1).close, fixture.at(-1).open);
    assert.equal(generate(fixture, config).status, 'NO_SIGNAL');
});

test('averages exactly the previous 20 volumes and excludes the current candle', () => {
    const fixture = candles.map(candle => ({ ...candle }));
    fixture[28].volume = 2000;
    fixture[29].volume = 0;
    for (let index = 30; index < 49; index += 1) {
        fixture[index].volume = 1000;
    }

    const previousTwentyAverage =
        fixture.slice(29, 49).reduce((sum, candle) => sum + candle.volume, 0) /
        20;
    assert.equal(previousTwentyAverage, 950);

    fixture.at(-1).volume = previousTwentyAverage * 1.2;
    assert.equal(generate(fixture).side, 'BUY');

    fixture.at(-1).volume -= 1;
    assert.equal(generate(fixture).status, 'NO_SIGNAL');
});

test('rejects missing, null, and non-finite volume', () => {
    const invalidVolumes = [
        { name: 'missing', set: candle => delete candle.volume },
        { name: 'null', set: candle => { candle.volume = null; } },
        { name: 'NaN', set: candle => { candle.volume = Number.NaN; } },
        { name: 'positive infinity', set: candle => { candle.volume = Infinity; } },
        { name: 'negative infinity', set: candle => { candle.volume = -Infinity; } },
    ];

    for (const { name, set } of invalidVolumes) {
        const fixture = candles.map(candle => ({ ...candle }));
        set(fixture.at(-1));

        assert.throws(
            () => generate(fixture),
            /invalid OHLCV data/,
            `expected ${name} volume to be rejected`,
        );
    }
});

test('rejects an inactive strategy', () => {
    assert.throws(
        () =>
            generate(candles, {
                ...NIFTY50_PAPER_STRATEGY_CONFIG,
                status: 'Inactive',
            }),
        /Inactive strategies cannot generate/,
    );
});

test('rejects a strategy configured with an unsupported instrument', () => {
    assert.throws(
        () =>
            generate(candles, {
                ...NIFTY50_PAPER_STRATEGY_CONFIG,
                instrument: 'UNSUPPORTED',
            }),
        /server-owned NIFTY50 paper strategy configuration is invalid/,
    );
});

test('rejects insufficient candle history', () => {
    assert.throws(
        () => generate(candles.slice(0, 49)),
        /Insufficient candle history/,
    );
});

test('rejects invalid OHLCV data', () => {
    const invalidCandles = candles.map(candle => ({ ...candle }));
    invalidCandles[10].volume = Number.NaN;

    assert.throws(
        () => generate(invalidCandles),
        /invalid OHLCV data/,
    );

    const invalidOhlcCandles = candles.map(candle => ({ ...candle }));
    invalidOhlcCandles[10].high = invalidOhlcCandles[10].close - 1;

    assert.throws(
        () => generate(invalidOhlcCandles),
        /invalid OHLCV data/,
    );
});

test('fails closed for invalid server-owned strategy configuration', () => {
    const invalidConfig = {
        ...NIFTY50_PAPER_STRATEGY_CONFIG,
        parameters: {
            ...NIFTY50_PAPER_STRATEGY_CONFIG.parameters,
            emaSlowPeriod: 0,
        },
    };

    assert.throws(
        () => generate(candles, invalidConfig),
        error =>
            error instanceof PaperProposalError &&
            error.statusCode === 503,
    );
});

test('rejects candles that are not eligible yet', () => {
    assert.throws(
        () =>
            generate(
                candles,
                NIFTY50_PAPER_STRATEGY_CONFIG,
                evaluationTime - 1,
            ),
        /Candle eligibility failed: A candle has not reached/,
    );
});

test('rejects an invalid calendar policy', () => {
    assert.throws(
        () =>
            generate(
                candles,
                NIFTY50_PAPER_STRATEGY_CONFIG,
                evaluationTime,
                { getCandleEndTime: () => null },
            ),
        /Candle eligibility failed: The session\/calendar policy rejected/,
    );
});
