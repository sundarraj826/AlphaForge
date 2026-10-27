import { getEligibleCandles } from './candle-eligibility.mjs';
import { UPSTOX_HISTORICAL_INSTRUMENT_KEYS } from '../config/upstox-instruments.mjs';
import { UPSTOX_HISTORICAL_TIMEFRAMES } from '../config/upstox-timeframes.mjs';

const REQUIRED_CONDITIONS = Object.freeze([
    'emaTrend',
    'priceAboveFastEma',
    'bullishCandle',
    'volumeConfirmation',
]);

export class PaperProposalError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'PaperProposalError';
        this.statusCode = statusCode;
    }
}

function isPositiveSafeInteger(value) {
    return Number.isSafeInteger(value) && value > 0;
}

export function validatePaperStrategyConfig(config) {
    if (
        !config ||
        typeof config !== 'object' ||
        config.id !== 'nifty50-intraday-trend' ||
        typeof config.name !== 'string' ||
        !config.name.trim() ||
        !isPositiveSafeInteger(config.version) ||
        !['Active', 'Inactive'].includes(config.status) ||
        config.instrument !== 'NIFTY50' ||
        config.market !== 'INDIAN_EQUITY_INTRADAY' ||
        !Object.hasOwn(UPSTOX_HISTORICAL_TIMEFRAMES, config.timeframe) ||
        config.timeframe !== '15m' ||
        !Array.isArray(config.supportedConditions) ||
        config.supportedConditions.length !== REQUIRED_CONDITIONS.length ||
        REQUIRED_CONDITIONS.some(
            (condition, index) =>
                config.supportedConditions[index] !== condition,
        ) ||
        !config.parameters ||
        !isPositiveSafeInteger(config.parameters.emaFastPeriod) ||
        !isPositiveSafeInteger(config.parameters.emaSlowPeriod) ||
        config.parameters.emaFastPeriod >= config.parameters.emaSlowPeriod ||
        !isPositiveSafeInteger(config.parameters.volumePeriod) ||
        !Number.isFinite(config.parameters.volumeMultiplier) ||
        config.parameters.volumeMultiplier <= 0 ||
        !config.evaluation ||
        !isPositiveSafeInteger(config.evaluation.minimumHistory) ||
        config.evaluation.minimumHistory <
            Math.max(
                config.parameters.emaSlowPeriod,
                config.parameters.volumePeriod + 1,
            ) ||
        !Number.isSafeInteger(config.evaluation.finalizationDelayMs) ||
        config.evaluation.finalizationDelayMs < 0 ||
        !isPositiveSafeInteger(config.evaluation.freshnessLimitMs) ||
        config.execution?.status !== 'UNAVAILABLE' ||
        config.execution.orderableInstrumentToken !== null ||
        config.execution.quantity !== null ||
        config.execution.limitPrice !== null ||
        typeof config.execution.reason !== 'string' ||
        !config.execution.reason.trim()
    ) {
        throw new PaperProposalError(
            'The server-owned NIFTY50 paper strategy configuration is invalid.',
            503,
        );
    }

    return config;
}

function validateCandles(candles) {
    for (const candle of candles) {
        if (
            !candle ||
            !Number.isFinite(candle.open) ||
            !Number.isFinite(candle.high) ||
            !Number.isFinite(candle.low) ||
            !Number.isFinite(candle.close) ||
            candle.open <= 0 ||
            candle.high <= 0 ||
            candle.low <= 0 ||
            candle.close <= 0 ||
            !Number.isFinite(candle.volume) ||
            candle.volume < 0 ||
            candle.high < Math.max(candle.open, candle.close) ||
            candle.low > Math.min(candle.open, candle.close) ||
            candle.high < candle.low
        ) {
            throw new PaperProposalError('A candle contains invalid OHLCV data.');
        }
    }
}

function latestEma(candles, period) {
    if (candles.length < period) {
        return null;
    }

    const seed = candles
        .slice(0, period)
        .reduce((sum, candle) => sum + candle.close, 0) / period;
    const multiplier = 2 / (period + 1);
    let ema = seed;

    for (let index = period; index < candles.length; index += 1) {
        ema =
            (candles[index].close - ema) * multiplier + ema;
    }

    return ema;
}

function hasBuySignal(candles, parameters) {
    const fastEma = latestEma(candles, parameters.emaFastPeriod);
    const slowEma = latestEma(candles, parameters.emaSlowPeriod);
    if (fastEma === null || slowEma === null) {
        return false;
    }

    const currentCandle = candles[candles.length - 1];
    const previousCandles = candles.slice(
        candles.length - parameters.volumePeriod - 1,
        candles.length - 1,
    );
    const averagePreviousVolume =
        previousCandles.reduce((sum, candle) => sum + candle.volume, 0) /
        parameters.volumePeriod;

    return (
        fastEma > slowEma &&
        currentCandle.close > fastEma &&
        currentCandle.close > currentCandle.open &&
        currentCandle.volume >=
            averagePreviousVolume * parameters.volumeMultiplier
    );
}

/**
 * Produces a paper signal only. Time-based candle eligibility is a heuristic,
 * not confirmation that the upstream provider finalized the candle.
 */
export function generatePaperProposal({
    candles,
    clock,
    calendarPolicy,
    configuration,
}) {
    const config = validatePaperStrategyConfig(configuration);
    if (config.status !== 'Active') {
        throw new PaperProposalError(
            'Inactive strategies cannot generate paper proposals.',
        );
    }
    if (typeof clock !== 'function') {
        throw new PaperProposalError('An evaluation clock is required.', 503);
    }
    if (!Array.isArray(candles) || candles.length < config.evaluation.minimumHistory) {
        throw new PaperProposalError(
            'Insufficient candle history for this strategy.',
        );
    }
    if (
        Object.hasOwn(
            UPSTOX_HISTORICAL_INSTRUMENT_KEYS,
            config.instrument,
        ) === false
    ) {
        throw new PaperProposalError('The strategy instrument is unsupported.');
    }

    validateCandles(candles);

    let evaluationTime;
    try {
        evaluationTime = clock();
    } catch {
        throw new PaperProposalError('The evaluation clock is unavailable.', 503);
    }

    let eligibleCandles;
    try {
        eligibleCandles = getEligibleCandles(
            candles,
            evaluationTime,
            config.timeframe,
            config.evaluation.finalizationDelayMs,
            config.evaluation.freshnessLimitMs,
            calendarPolicy,
        );
    } catch (error) {
        throw new PaperProposalError(
            error instanceof Error
                ? `Candle eligibility failed: ${error.message}`
                : 'Candle eligibility failed.',
        );
    }

    const latestCandle = eligibleCandles[eligibleCandles.length - 1];
    const signal = hasBuySignal(eligibleCandles, config.parameters)
        ? 'BUY'
        : 'WAIT';

    if (signal === 'WAIT') {
        return {
            status: 'NO_SIGNAL',
            strategyId: config.id,
            strategyVersion: config.version,
            instrument: config.instrument,
            timeframe: config.timeframe,
            signalTimestamp: latestCandle.timestamp,
            evaluatedAt: evaluationTime,
        };
    }

    return {
        status: 'PAPER_PROPOSAL',
        strategyId: config.id,
        strategyVersion: config.version,
        instrument: config.instrument,
        timeframe: config.timeframe,
        side: signal,
        signalTimestamp: latestCandle.timestamp,
        evaluatedAt: evaluationTime,
        referencePrice: latestCandle.close,
        execution: {
            status: config.execution.status,
            orderableInstrumentToken:
                config.execution.orderableInstrumentToken,
            quantity: config.execution.quantity,
            limitPrice: config.execution.limitPrice,
            riskCheck: 'NOT_EVALUATED',
            reason: config.execution.reason,
        },
    };
}
