import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CandleEligibilityError,
    getEligibleCandles,
} from './candle-eligibility.mjs';

const START_TIME = Date.parse('2026-10-27T09:15:00+05:30');
const FIFTEEN_MINUTES_MS = 15 * 60_000;
const FINALIZATION_DELAY_MS = 5_000;
const FRESHNESS_LIMIT_MS = 60_000;
const candle = timestamp => ({
    timestamp,
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    volume: 1000,
});
const sessionPolicy = {
    getCandleEndTime: ({ candleStartTime, nominalDurationMs }) =>
        candleStartTime + nominalDurationMs,
};

function validateAt(
    evaluationTime,
    candles = [candle(START_TIME)],
    policy = sessionPolicy,
) {
    return getEligibleCandles(
        candles,
        evaluationTime,
        '15m',
        FINALIZATION_DELAY_MS,
        FRESHNESS_LIMIT_MS,
        policy,
    );
}

test('accepts a candle at exact close-plus-delay boundary', () => {
    const evaluationTime =
        START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS;

    assert.deepEqual(validateAt(evaluationTime), [candle(START_TIME)]);
});

test('rejects a candle just before its close boundary', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS - 1,
            ),
        /not reached its configured eligibility time/,
    );
});

test('requires the configured delay after the candle close', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS - 1,
            ),
        /not reached its configured eligibility time/,
    );
});

test('rejects a stale latest candle independently of its finalization delay', () => {
    assert.throws(
        () =>
            getEligibleCandles(
                [candle(START_TIME)],
                START_TIME + FIFTEEN_MINUTES_MS +
                    FINALIZATION_DELAY_MS + FRESHNESS_LIMIT_MS + 1,
                '15m',
                FINALIZATION_DELAY_MS,
                FRESHNESS_LIMIT_MS,
                sessionPolicy,
            ),
        /latest candle is stale/,
    );
});

test('accepts a candle at the exact freshness limit', () => {
    const evaluationTime =
        START_TIME + FIFTEEN_MINUTES_MS + FRESHNESS_LIMIT_MS;

    assert.deepEqual(validateAt(evaluationTime), [candle(START_TIME)]);
});

test('rejects a future-dated candle', () => {
    assert.throws(
        () => validateAt(START_TIME - 1),
        /timestamp is in the future/,
    );
});

test('rejects duplicate timestamps', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS,
                [candle(START_TIME), candle(START_TIME)],
            ),
        /Duplicate candle timestamps/,
    );
});

test('rejects out-of-order timestamps without sorting', () => {
    const candles = [
        candle(START_TIME + FIFTEEN_MINUTES_MS),
        candle(START_TIME),
    ];

    assert.throws(
        () =>
            validateAt(
                START_TIME + (2 * FIFTEEN_MINUTES_MS) + FINALIZATION_DELAY_MS,
                candles,
            ),
        /strictly increasing order/,
    );
    assert.equal(candles[0].timestamp, START_TIME + FIFTEEN_MINUTES_MS);
});

test('rejects a candle boundary not accepted by the session/calendar policy', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS,
                [candle(START_TIME)],
                { getCandleEndTime: () => null },
            ),
        /session\/calendar policy rejected/,
    );
});

test('rejects a calendar policy end timestamp equal to the candle start', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS,
                [candle(START_TIME)],
                { getCandleEndTime: ({ candleStartTime }) => candleStartTime },
            ),
        /session\/calendar policy rejected/,
    );
});

test('rejects a calendar policy end timestamp beyond the timeframe', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS,
                [candle(START_TIME)],
                {
                    getCandleEndTime: ({ candleStartTime, nominalDurationMs }) =>
                        candleStartTime + nominalDurationMs + 1,
                },
            ),
        /session\/calendar policy rejected/,
    );
});

test('rejects non-integer and unsafe calendar policy end timestamps', () => {
    const invalidEndTimes = [
        START_TIME + FIFTEEN_MINUTES_MS + 0.5,
        Number.MAX_SAFE_INTEGER + 1,
    ];

    for (const endTime of invalidEndTimes) {
        assert.throws(
            () =>
                validateAt(
                    START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS,
                    [candle(START_TIME)],
                    { getCandleEndTime: () => endTime },
                ),
            /session\/calendar policy rejected/,
        );
    }
});

test('propagates errors thrown by the calendar policy', () => {
    assert.throws(
        () =>
            validateAt(
                START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS,
                [candle(START_TIME)],
                {
                    getCandleEndTime: () => {
                        throw new Error('calendar policy unavailable');
                    },
                },
            ),
        /calendar policy unavailable/,
    );
});

test('fails closed when required configuration is missing or invalid', () => {
    const evaluationTime =
        START_TIME + FIFTEEN_MINUTES_MS + FINALIZATION_DELAY_MS;
    const invalidCalls = [
        () =>
            getEligibleCandles(
                [],
                evaluationTime,
                '15m',
                0,
                1000,
                sessionPolicy,
            ),
        () =>
            getEligibleCandles(
                [candle(START_TIME)],
                evaluationTime,
                '15m',
                -1,
                1000,
                sessionPolicy,
            ),
        () =>
            getEligibleCandles(
                [candle(START_TIME)],
                evaluationTime,
                '15m',
                0,
                0,
                sessionPolicy,
            ),
        () =>
            getEligibleCandles(
                [candle(START_TIME)],
                evaluationTime,
                'unsupported',
                0,
                1000,
                sessionPolicy,
            ),
        () =>
            getEligibleCandles(
                [candle(START_TIME)],
                evaluationTime,
                '15m',
                0,
                1000,
                null,
            ),
    ];

    for (const call of invalidCalls) {
        assert.throws(call, CandleEligibilityError);
    }
});
