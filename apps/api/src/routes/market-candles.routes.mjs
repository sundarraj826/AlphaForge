
import { MockMarketCandleProvider } from '../services/market-candle-provider.mjs';
import {
    UpstoxHistoricalCandleProvider,
} from '../services/upstox-historical-candle-provider.mjs';
import { UPSTOX_HISTORICAL_INSTRUMENT_KEYS } from '../config/upstox-instruments.mjs';

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

        if (!fromDate || !toDate) {
            return sendJson(response, 400, {
                status: 'error',
                message: 'fromDate and toDate are required for Upstox candles.',
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
            interval: 5,
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
