import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createNseEquitySessionCalendarPolicy,
    NseEquityCalendarPolicyError,
} from './nse-equity-session-calendar-policy.mjs';

// Synthetic fixtures only. They are not an authoritative NSE calendar.
const syntheticCalendar = {
    timeZone: 'Asia/Kolkata',
    sessionTemplates: {
        syntheticRegular: [{ open: '09:15', close: '15:30' }],
    },
    dates: {
        '2026-10-27': {
            status: 'TRADING',
            sessionTemplate: 'syntheticRegular',
        },
        '2026-10-28': { status: 'HOLIDAY' },
        '2026-10-29': { status: 'UNKNOWN' },
        '2026-10-30': {
            status: 'TRADING',
            sessions: [{ open: '10:00', close: '11:00' }],
        },
        '2026-11-02': {
            status: 'TRADING',
            sessions: [{ open: '10:00', close: '10:10' }],
        },
        '2026-11-03': {
            status: 'TRADING',
            sessions: [
                { open: '09:15', close: '10:00' },
                { open: '10:30', close: '11:15' },
            ],
        },
        '2026-11-04': {
            status: 'TRADING',
            sessions: [
                { open: '09:15', close: '09:20' },
                { open: '09:30', close: '10:00' },
            ],
        },
    },
};

const policy = () => createNseEquitySessionCalendarPolicy(syntheticCalendar);
const localTime = (date, time) => Date.parse(`${date}T${time}:00+05:30`);
const duration15m = 15 * 60_000;

function assertPolicyError(call, pattern) {
    assert.throws(call, error => {
        assert.ok(error instanceof NseEquityCalendarPolicyError);
        assert.match(error.message, pattern);
        return true;
    });
}

test('returns regular session candle ends in Asia/Kolkata time', () => {
    const calendar = policy();

    assert.equal(
        calendar.getCandleEndTime({
            candleStartTime: localTime('2026-10-27', '09:15'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        localTime('2026-10-27', '09:30'),
    );
    assert.equal(
        calendar.getCandleEndTime({
            candleStartTime: localTime('2026-10-27', '15:15'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        localTime('2026-10-27', '15:30'),
    );
});

test('rejects candles before or at the close of a supplied session', () => {
    const calendar = policy();

    for (const time of ['09:00', '15:30']) {
        assertPolicyError(
            () => calendar.getCandleEndTime({
                candleStartTime: localTime('2026-10-27', time),
                nominalDurationMs: duration15m,
                timeframe: '15m',
            }),
            /outside a supplied trading session/,
        );
    }
});

test('rejects a candle whose interval crosses the session boundary', () => {
    assertPolicyError(
        () => policy().getCandleEndTime({
            candleStartTime: localTime('2026-11-02', '10:00'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /crosses a supplied session boundary/,
    );
});

test('supports separate non-overlapping sessions and rejects starts in the gap', () => {
    const calendar = policy();

    assert.equal(
        calendar.getCandleEndTime({
            candleStartTime: localTime('2026-11-03', '09:45'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        localTime('2026-11-03', '10:00'),
    );
    assert.equal(
        calendar.getCandleEndTime({
            candleStartTime: localTime('2026-11-03', '10:30'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        localTime('2026-11-03', '10:45'),
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({
            candleStartTime: localTime('2026-11-03', '10:15'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /outside a supplied trading session/,
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({
            candleStartTime: localTime('2026-11-04', '09:15'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /crosses a supplied session boundary/,
    );
});

test('accepts a candle ending at close and rejects one ending one millisecond after close', () => {
    const calendar = policy();
    const candleStartTime = localTime('2026-10-27', '15:15');

    assert.equal(
        calendar.getCandleEndTime({
            candleStartTime,
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        localTime('2026-10-27', '15:30'),
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({
            candleStartTime: candleStartTime + 1,
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /crosses a supplied session boundary/,
    );
});

test('rejects dates explicitly marked holiday or unknown', () => {
    const calendar = policy();

    for (const [date, expected] of [
        ['2026-10-28', /marked holiday/],
        ['2026-10-29', /marked unknown/],
    ]) {
        assertPolicyError(
            () => calendar.getCandleEndTime({
                candleStartTime: localTime(date, '09:15'),
                nominalDurationMs: duration15m,
                timeframe: '15m',
            }),
            expected,
        );
    }
});

test('fails closed when the calendar has no entry for the candle date', () => {
    assertPolicyError(
        () => policy().getCandleEndTime({
            candleStartTime: localTime('2026-10-31', '09:15'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /missing for the candle date/,
    );
});

test('uses the Asia/Kolkata local date across UTC date boundaries', () => {
    const calendar = policy();

    assertPolicyError(
        () => calendar.getCandleEndTime({
            candleStartTime: Date.parse('2026-10-26T18:30:00.000Z'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /outside a supplied trading session/,
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({
            candleStartTime: Date.parse('2026-10-27T18:30:00.000Z'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /marked holiday/,
    );
});

test('uses exceptional session times only on the explicitly configured date', () => {
    const calendar = policy();

    assert.equal(
        calendar.getCandleEndTime({
            candleStartTime: localTime('2026-10-30', '10:00'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        localTime('2026-10-30', '10:15'),
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({
            candleStartTime: localTime('2026-10-30', '09:15'),
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /outside a supplied trading session/,
    );
});

test('accepts 15m and rejects unsupported 1H, 4H, 1D, and other intervals', () => {
    const calendar = policy();
    const base = {
        candleStartTime: localTime('2026-10-27', '09:15'),
        nominalDurationMs: duration15m,
        timeframe: '15m',
    };

    assertPolicyError(
        () => calendar.getCandleEndTime({
            ...base,
            candleStartTime: localTime('2026-10-27', '09:16'),
        }),
        /not aligned/,
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({ ...base, timeframe: '2m' }),
        /timeframe is unsupported/,
    );
    for (const [timeframe, nominalDurationMs] of [
        ['1H', 60 * 60_000],
        ['4H', 4 * 60 * 60_000],
        ['1D', 24 * 60 * 60_000],
    ]) {
        assertPolicyError(
            () => calendar.getCandleEndTime({
                ...base,
                timeframe,
                nominalDurationMs,
            }),
            /timeframe is unsupported/,
        );
    }
    assertPolicyError(
        () => calendar.getCandleEndTime({
            ...base,
            candleStartTime: localTime('2026-10-27', '09:15') + 1,
        }),
        /not aligned/,
    );
    assertPolicyError(
        () => calendar.getCandleEndTime({ ...base, nominalDurationMs: 5_000 }),
        /does not match/,
    );
});

test('rejects invalid date keys with a policy-level error', () => {
    for (const date of ['2026-02-30', 'not-a-date']) {
        const invalidCalendar = {
            ...syntheticCalendar,
            dates: {
                ...syntheticCalendar.dates,
                [date]: { status: 'HOLIDAY' },
            },
        };
        assertPolicyError(
            () => createNseEquitySessionCalendarPolicy(invalidCalendar),
            /valid YYYY-MM-DD/,
        );
    }
});

test('rejects every contradictory trading and non-trading session entry', () => {
    const contradictoryEntries = [
        { status: 'HOLIDAY', sessions: [{ open: '09:15', close: '15:30' }] },
        { status: 'HOLIDAY', sessionTemplate: 'syntheticRegular' },
        { status: 'UNKNOWN', sessions: [{ open: '09:15', close: '15:30' }] },
        { status: 'UNKNOWN', sessionTemplate: 'syntheticRegular' },
        {
            status: 'TRADING',
            sessionTemplate: 'syntheticRegular',
            sessions: [{ open: '10:00', close: '11:00' }],
        },
    ];

    for (const entry of contradictoryEntries) {
        const invalidCalendar = {
            ...syntheticCalendar,
            dates: {
                ...syntheticCalendar.dates,
                '2026-10-27': entry,
            },
        };
        assert.throws(
            () => createNseEquitySessionCalendarPolicy(invalidCalendar),
            NseEquityCalendarPolicyError,
        );
    }
});

test('rejects invalid timestamps and malformed injected calendar data', () => {
    assertPolicyError(
        () => policy().getCandleEndTime({
            candleStartTime: 1.5,
            nominalDurationMs: duration15m,
            timeframe: '15m',
        }),
        /safe integer milliseconds/,
    );

    for (const invalidCalendar of [
        { ...syntheticCalendar, timeZone: 'UTC' },
        {
            ...syntheticCalendar,
            dates: {
                ...syntheticCalendar.dates,
                '2026-10-27': {
                    status: 'TRADING',
                    sessions: [{ open: '15:30', close: '09:15' }],
                },
            },
        },
        {
            ...syntheticCalendar,
            dates: {
                ...syntheticCalendar.dates,
                '2026-10-27': { status: 'TRADING', sessionTemplate: 'missing' },
            },
        },
    ]) {
        assert.throws(
            () => createNseEquitySessionCalendarPolicy(invalidCalendar),
            NseEquityCalendarPolicyError,
        );
    }
});
