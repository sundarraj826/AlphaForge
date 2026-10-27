
import { MockMarketCandleProvider } from '../services/market-candle-provider.mjs';
import {
    UpstoxHistoricalCandleProvider,
} from '../services/upstox-historical-candle-provider.mjs';
import { UPSTOX_HISTORICAL_INSTRUMENT_KEYS } from '../config/upstox-instruments.mjs';
import { UPSTOX_HISTORICAL_TIMEFRAMES } from '../config/upstox-timeframes.mjs';

const mockProvider = new MockMarketCandleProvider();
const historicalProvider = new UpstoxHistoricalCandleProvider();

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });

    response.end(JSON.stringify(body));
}

export async function handleMarketCandles(
    request,
    response,
    { historicalProvider: provider = historicalProvider } = {},
) {
    try {
        const url = new URL(
            request.url ?? '/api/market/candles',
            'http://localhost',
        );

        const source = url.searchParams.get('source') ?? 'mock';

        if (source === 'mock') {
            const candles = await mockProvider.getHistoricalCandles();

            return sendJson(response, 200, {
                status: 'success',
                source: 'mock',
                data: { candles },
            });
        }

        if (source !== 'upstox') {
            return sendJson(response, 400, {
                status: 'error',
                message: 'Unsupported market candle source.',
            });
        }

        const fromDate = url.searchParams.get('fromDate');
        const toDate = url.searchParams.get('toDate');
        const strategyInstrument = url.searchParams.get('instrument');
        const timeframe = url.searchParams.get('timeframe');

        if (!fromDate || !toDate) {
            return sendJson(response, 400, {
                status: 'error',
                message: 'fromDate and toDate are required for Upstox candles.',
            });
        }

        if (
            !timeframe ||
            !Object.hasOwn(UPSTOX_HISTORICAL_TIMEFRAMES, timeframe)
        ) {
            return sendJson(response, 400, {
                status: 'error',
                message:
                    'A supported timeframe is required (1m, 5m, 15m, 1H, 4H, or 1D).',
            });
        }

        const {
            unit,
            interval,
            earliestAvailableDate,
            maxLookbackMonths,
        } =
            UPSTOX_HISTORICAL_TIMEFRAMES[timeframe];

        if (!isValidDateRange(fromDate, toDate)) {
            return sendJson(response, 400, {
                status: 'error',
                message: 'Invalid historical candle date range.',
            });
        }

        if (fromDate < earliestAvailableDate) {
            return sendJson(response, 400, {
                status: 'error',
                message:
                    `Historical data for the selected timeframe is available from ${earliestAvailableDate}. ` +
                    'Choose a later start date.',
            });
        }

        const earliestDate = subtractMonths(toDate, maxLookbackMonths);

        if (fromDate < earliestDate) {
            const limit =
                maxLookbackMonths === 1
                    ? '1 month'
                    : maxLookbackMonths === 3
                        ? '1 quarter'
                        : '10 years';

            return sendJson(response, 400, {
                status: 'error',
                message:
                    `The selected timeframe supports up to ${limit} of Upstox historical data. ` +
                    'Choose a shorter date range.',
            });
        }

        const instrumentKey =
            strategyInstrument !== null &&
                Object.hasOwn(
                    UPSTOX_HISTORICAL_INSTRUMENT_KEYS,
                    strategyInstrument,
                )
                ? UPSTOX_HISTORICAL_INSTRUMENT_KEYS[strategyInstrument]
                : undefined;

        if (!instrumentKey) {
            return sendJson(response, 400, {
                status: 'error',
                message: 'Unsupported historical instrument.',
            });
        }

        const candles = await provider.getHistoricalCandles({
            instrumentKey,
            unit,
            interval,
            fromDate,
            toDate,
        });

        return sendJson(response, 200, {
            status: 'success',
            source: 'upstox',
            data: { candles },
        });
    } catch (error) {
        // Do not expose tokens or raw upstream response details.
        console.error('Failed to retrieve market candles:', error.message);

        return sendJson(response, 502, {
            status: 'error',
            message: 'Failed to retrieve market candles.',
        });
    }
}

function isValidDateRange(fromDate, toDate) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const isValidDate = (date) => {
        if (!datePattern.test(date)) {
            return false;
        }

        const parsed = new Date(`${date}T00:00:00.000Z`);

        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === date
        );
    };

    return isValidDate(fromDate) && isValidDate(toDate) && fromDate <= toDate;
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
