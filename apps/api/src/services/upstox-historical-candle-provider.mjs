
import { mapHistoricalCandleResponse } from './market-candle-mapper.mjs';
import { UPSTOX_HISTORICAL_TIMEFRAMES } from '../config/upstox-timeframes.mjs';

const BASE_URL = 'https://api.upstox.com/v3';

export class UpstoxHistoricalCandleProvider {

    async getHistoricalCandles({
        instrumentKey,
        unit,
        interval,
        fromDate,
        toDate,
    }) {
        // 1. Validate required dates first.
        if (!fromDate || !toDate) {
            throw new Error('fromDate and toDate are required.');
        }

        if (typeof instrumentKey !== 'string' || !instrumentKey.trim()) {
            throw new Error('A supported instrument key is required.');
        }

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (
            !datePattern.test(fromDate) ||
            !datePattern.test(toDate) ||
            fromDate > toDate
        ) {
            throw new Error('Invalid historical candle date range.');
        }

        // 2. Validate real calendar dates.
        const isValidDate = (date) => {
            const parsed = new Date(`${date}T00:00:00.000Z`);

            return (
                !Number.isNaN(parsed.getTime()) &&
                parsed.toISOString().slice(0, 10) === date
            );
        };

        if (!isValidDate(fromDate) || !isValidDate(toDate)) {
            throw new Error('Invalid historical candle date range.');
        }

        // 3. Validate the explicit Upstox V3 candle interval.
        const supportedInterval = Object.values(
            UPSTOX_HISTORICAL_TIMEFRAMES,
        ).some(
            timeframe =>
                timeframe.unit === unit &&
                timeframe.interval === interval,
        );

        if (!supportedInterval) {
            throw new Error(
                'A supported Upstox V3 candle unit and interval are required.',
            );
        }

        // 4. Check the token only after input validation.
        const token = process.env.UPSTOX_MARKET_DATA_ACCESS_TOKEN;

        if (!token) {
            throw new Error(
                'Historical market-data access token is not configured.',
            );
        }

        // 5. Build the historical-candle request.
        const url = new URL(
            `${BASE_URL}/historical-candle/` +
            `${encodeURIComponent(instrumentKey)}/${unit}/${interval}/` +
            `${toDate}/${fromDate}`,
        );

        // 6. Make the read-only request.
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new Error(
                `Upstox historical candle request failed (HTTP ${response.status}).`,
            );
        }

        // 7. Map the API response to AlphaForge candles.
        const payload = await response.json();

        return mapHistoricalCandleResponse(payload);
    }

}
