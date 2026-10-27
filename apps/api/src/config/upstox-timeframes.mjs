export const UPSTOX_HISTORICAL_TIMEFRAMES = Object.freeze({
    '1m': Object.freeze({
        unit: 'minutes',
        interval: 1,
        earliestAvailableDate: '2022-01-01',
        maxLookbackMonths: 1,
    }),
    '5m': Object.freeze({
        unit: 'minutes',
        interval: 5,
        earliestAvailableDate: '2022-01-01',
        maxLookbackMonths: 1,
    }),
    '15m': Object.freeze({
        unit: 'minutes',
        interval: 15,
        earliestAvailableDate: '2022-01-01',
        maxLookbackMonths: 1,
    }),
    '1H': Object.freeze({
        unit: 'hours',
        interval: 1,
        earliestAvailableDate: '2022-01-01',
        maxLookbackMonths: 3,
    }),
    '4H': Object.freeze({
        unit: 'hours',
        interval: 4,
        earliestAvailableDate: '2022-01-01',
        maxLookbackMonths: 3,
    }),
    '1D': Object.freeze({
        unit: 'days',
        interval: 1,
        earliestAvailableDate: '2000-01-01',
        maxLookbackMonths: 120,
    }),
});
