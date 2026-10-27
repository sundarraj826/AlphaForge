import { UPSTOX_HISTORICAL_TIMEFRAMES } from '../config/upstox-timeframes.mjs';

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

export class CandleEligibilityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CandleEligibilityError';
    }
}

function getTimeframeDurationMs(timeframe) {
    const config = Object.hasOwn(UPSTOX_HISTORICAL_TIMEFRAMES, timeframe)
        ? UPSTOX_HISTORICAL_TIMEFRAMES[timeframe]
        : null;
    if (!config || !Number.isSafeInteger(config.interval) || config.interval <= 0) {
        throw new CandleEligibilityError('A supported candle timeframe is required.');
    }

    const unitDuration = {
        minutes: MILLISECONDS_PER_MINUTE,
        hours: MILLISECONDS_PER_HOUR,
        days: MILLISECONDS_PER_DAY,
    }[config.unit];

    if (!unitDuration) {
        throw new CandleEligibilityError('The candle timeframe unit is unsupported.');
    }

    const durationMs = config.interval * unitDuration;
    if (!Number.isSafeInteger(durationMs)) {
        throw new CandleEligibilityError('The candle timeframe duration is invalid.');
    }

    return durationMs;
}

function validateConfiguration(
    candles,
    evaluationTime,
    timeframe,
    finalizationDelayMs,
    freshnessLimitMs,
    sessionPolicy,
) {
    if (!Array.isArray(candles) || candles.length === 0) {
        throw new CandleEligibilityError('At least one candle is required.');
    }
    if (!Number.isSafeInteger(evaluationTime) || evaluationTime < 0) {
        throw new CandleEligibilityError('A valid evaluation time is required.');
    }
    if (
        !Number.isSafeInteger(finalizationDelayMs) ||
        finalizationDelayMs < 0
    ) {
        throw new CandleEligibilityError('A valid finalization delay is required.');
    }
    if (!Number.isSafeInteger(freshnessLimitMs) || freshnessLimitMs <= 0) {
        throw new CandleEligibilityError('A valid freshness limit is required.');
    }
    if (
        !sessionPolicy ||
        typeof sessionPolicy.getCandleEndTime !== 'function'
    ) {
        throw new CandleEligibilityError(
            'An explicit candle session/calendar policy is required.',
        );
    }

    return getTimeframeDurationMs(timeframe);
}

/**
 * Validates candle chronology and time-based eligibility.
 *
 * The elapsed-time closure check is a configurable heuristic only; it does not
 * prove that an upstream provider has finalized or will not revise a candle.
 */
export function getEligibleCandles(
    candles,
    evaluationTime,
    timeframe,
    finalizationDelayMs,
    freshnessLimitMs,
    sessionPolicy,
) {
    const nominalDurationMs = validateConfiguration(
        candles,
        evaluationTime,
        timeframe,
        finalizationDelayMs,
        freshnessLimitMs,
        sessionPolicy,
    );
    let previousTimestamp = -1;
    let latestEndTime = null;

    for (const candle of candles) {
        if (
            !candle ||
            !Number.isSafeInteger(candle.timestamp) ||
            candle.timestamp < 0
        ) {
            throw new CandleEligibilityError('A candle has an invalid timestamp.');
        }
        if (candle.timestamp > evaluationTime) {
            throw new CandleEligibilityError('A candle timestamp is in the future.');
        }
        if (candle.timestamp === previousTimestamp) {
            throw new CandleEligibilityError('Duplicate candle timestamps are not allowed.');
        }
        if (candle.timestamp < previousTimestamp) {
            throw new CandleEligibilityError(
                'Candle timestamps must be in strictly increasing order.',
            );
        }
        previousTimestamp = candle.timestamp;

        const latestPermittedEndTime =
            candle.timestamp + nominalDurationMs;
        if (!Number.isSafeInteger(latestPermittedEndTime)) {
            throw new CandleEligibilityError(
                'The candle timeframe boundary is outside the supported range.',
            );
        }

        const candleEndTime = sessionPolicy.getCandleEndTime({
            candleStartTime: candle.timestamp,
            nominalDurationMs,
            timeframe,
        });
        if (
            !Number.isSafeInteger(candleEndTime) ||
            candleEndTime <= candle.timestamp ||
            candleEndTime > latestPermittedEndTime
        ) {
            throw new CandleEligibilityError(
                'The session/calendar policy rejected a candle boundary.',
            );
        }
        const eligibilityTime = candleEndTime + finalizationDelayMs;
        if (!Number.isSafeInteger(eligibilityTime)) {
            throw new CandleEligibilityError(
                'The candle eligibility boundary is outside the supported range.',
            );
        }
        if (evaluationTime < eligibilityTime) {
            throw new CandleEligibilityError(
                'A candle has not reached its configured eligibility time.',
            );
        }

        latestEndTime = candleEndTime;
    }

    if (evaluationTime - latestEndTime > freshnessLimitMs) {
        throw new CandleEligibilityError('The latest candle is stale.');
    }

    return [...candles];
}
