export const NIFTY50_PAPER_STRATEGY_CONFIG = Object.freeze({
    id: 'nifty50-intraday-trend',
    name: 'NIFTY Intraday Trend',
    version: 1,
    status: 'Active',
    instrument: 'NIFTY50',
    market: 'INDIAN_EQUITY_INTRADAY',
    timeframe: '15m',
    supportedConditions: Object.freeze([
        'emaTrend',
        'priceAboveFastEma',
        'bullishCandle',
        'volumeConfirmation',
    ]),
    parameters: Object.freeze({
        emaFastPeriod: 20,
        emaSlowPeriod: 50,
        volumePeriod: 20,
        volumeMultiplier: 1.2,
    }),
    evaluation: Object.freeze({
        minimumHistory: 50,
        finalizationDelayMs: 5_000,
        freshnessLimitMs: 60_000,
    }),
    execution: Object.freeze({
        status: 'UNAVAILABLE',
        orderableInstrumentToken: null,
        quantity: null,
        limitPrice: null,
        reason:
            'Orderable instrument mapping and server-controlled sizing are not verified.',
    }),
});
