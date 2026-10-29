import {
    NIFTY50_PAPER_STRATEGY_CONFIG,
} from '../config/nifty50-paper-strategy.config.mjs';
import { UPSTOX_HISTORICAL_INSTRUMENT_KEYS } from '../config/upstox-instruments.mjs';
import { UPSTOX_HISTORICAL_TIMEFRAMES } from '../config/upstox-timeframes.mjs';
import { generatePaperProposal } from './paper-proposal.service.mjs';

const INDIA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

export class PaperProposalGenerationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PaperProposalGenerationError';
    }
}

function getIndiaDate(timestamp) {
    return INDIA_DATE_FORMATTER.format(new Date(timestamp));
}

function subtractMonths(date, months) {
    const [year, month, day] = date.split('-').map(Number);
    const targetMonth = year * 12 + month - 1 - months;
    const targetYear = Math.floor(targetMonth / 12);
    const targetMonthOfYear = targetMonth - targetYear * 12;
    const lastDay = new Date(
        Date.UTC(targetYear, targetMonthOfYear + 1, 0),
    ).getUTCDate();

    return [
        String(targetYear).padStart(4, '0'),
        String(targetMonthOfYear + 1).padStart(2, '0'),
        String(Math.min(day, lastDay)).padStart(2, '0'),
    ].join('-');
}

function validateProviderCandles(candles, minimumHistory, evaluationTime) {
    if (!Array.isArray(candles) || candles.length < minimumHistory) {
        throw new PaperProposalGenerationError(
            'Historical candle data is incomplete.',
        );
    }

    let previousTimestamp = -1;
    for (const candle of candles) {
        if (
            !candle ||
            !Number.isSafeInteger(candle.timestamp) ||
            candle.timestamp < 0 ||
            candle.timestamp > evaluationTime ||
            candle.timestamp <= previousTimestamp ||
            !Number.isFinite(candle.open) ||
            !Number.isFinite(candle.high) ||
            !Number.isFinite(candle.low) ||
            !Number.isFinite(candle.close) ||
            !Number.isFinite(candle.volume) ||
            candle.open <= 0 ||
            candle.high <= 0 ||
            candle.low <= 0 ||
            candle.close <= 0 ||
            candle.volume < 0 ||
            candle.high < Math.max(candle.open, candle.close) ||
            candle.low > Math.min(candle.open, candle.close) ||
            candle.high < candle.low
        ) {
            throw new PaperProposalGenerationError(
                'Historical candle data is invalid.',
            );
        }
        previousTimestamp = candle.timestamp;
    }
}

function getEvaluationTime(clock) {
    let evaluationTime;
    try {
        evaluationTime = clock();
    } catch {
        throw new PaperProposalGenerationError(
            'The evaluation clock is unavailable.',
        );
    }

    if (
        !Number.isSafeInteger(evaluationTime) ||
        evaluationTime < 0 ||
        Number.isNaN(new Date(evaluationTime).getTime())
    ) {
        throw new PaperProposalGenerationError(
            'The evaluation clock is unavailable.',
        );
    }

    return evaluationTime;
}

export function createPaperProposalGenerationService({
    historicalCandleProvider,
    proposalStore,
    clock = Date.now,
    calendarPolicy,
    candleFinalityPolicy,
} = {}) {
    if (
        typeof historicalCandleProvider?.getHistoricalCandles !== 'function' ||
        typeof proposalStore?.insert !== 'function' ||
        typeof clock !== 'function' ||
        typeof calendarPolicy?.getCandleEndTime !== 'function' ||
        typeof candleFinalityPolicy?.areFinalized !== 'function'
    ) {
        throw new PaperProposalGenerationError(
            'Generation dependencies are incomplete.',
        );
    }

    return {
        async generateAndPersist() {
            const timeframe =
                UPSTOX_HISTORICAL_TIMEFRAMES[
                    NIFTY50_PAPER_STRATEGY_CONFIG.timeframe
                ];
            const requestTime = getEvaluationTime(clock);
            const toDate = getIndiaDate(requestTime);
            const fromDate = subtractMonths(
                toDate,
                timeframe.maxLookbackMonths,
            );

            if (fromDate < timeframe.earliestAvailableDate) {
                throw new PaperProposalGenerationError(
                    'The requested historical range is unavailable.',
                );
            }

            let candles;
            try {
                candles =
                    await historicalCandleProvider.getHistoricalCandles({
                        instrumentKey:
                            UPSTOX_HISTORICAL_INSTRUMENT_KEYS[
                                NIFTY50_PAPER_STRATEGY_CONFIG.instrument
                            ],
                        unit: timeframe.unit,
                        interval: timeframe.interval,
                        fromDate,
                        toDate,
                    });
            } catch {
                throw new PaperProposalGenerationError(
                    'Historical candle retrieval failed.',
                );
            }

            const evaluationTime = getEvaluationTime(clock);
            validateProviderCandles(
                candles,
                NIFTY50_PAPER_STRATEGY_CONFIG.evaluation.minimumHistory,
                evaluationTime,
            );

            try {
                if (
                    await candleFinalityPolicy.areFinalized({
                        candles,
                        evaluationTime,
                        timeframe: NIFTY50_PAPER_STRATEGY_CONFIG.timeframe,
                    }) !== true
                ) {
                    throw new PaperProposalGenerationError(
                        'Candle finality could not be established.',
                    );
                }
            } catch (error) {
                if (error instanceof PaperProposalGenerationError) {
                    throw error;
                }
                throw new PaperProposalGenerationError(
                    'Candle finality could not be established.',
                );
            }

            let generated;
            try {
                generated = generatePaperProposal({
                    candles,
                    clock: () => evaluationTime,
                    calendarPolicy,
                    configuration: NIFTY50_PAPER_STRATEGY_CONFIG,
                });
            } catch {
                throw new PaperProposalGenerationError(
                    'Candle eligibility or strategy validation failed.',
                );
            }

            if (generated.status === 'NO_SIGNAL') {
                return generated;
            }

            let insertion;
            try {
                insertion = proposalStore.insert(generated);
            } catch {
                throw new PaperProposalGenerationError(
                    'Paper-proposal persistence failed.',
                );
            }

            if (
                !insertion ||
                typeof insertion.created !== 'boolean' ||
                insertion.proposal?.payload?.status !== 'PAPER_PROPOSAL' ||
                insertion.proposal.strategyId !== generated.strategyId ||
                insertion.proposal.strategyVersion !== generated.strategyVersion ||
                insertion.proposal.instrument !== generated.instrument ||
                insertion.proposal.signal !== generated.side ||
                insertion.proposal.candleTimestamp !== generated.signalTimestamp ||
                insertion.proposal.payload.strategyId !== generated.strategyId ||
                insertion.proposal.payload.strategyVersion !== generated.strategyVersion ||
                insertion.proposal.payload.instrument !== generated.instrument ||
                insertion.proposal.payload.side !== generated.side ||
                insertion.proposal.payload.signalTimestamp !== generated.signalTimestamp
            ) {
                throw new PaperProposalGenerationError(
                    'Paper-proposal persistence failed.',
                );
            }

            return {
                status: 'PERSISTED',
                created: insertion.created,
                proposal: insertion.proposal,
            };
        },
    };
}
