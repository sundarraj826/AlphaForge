
import { mapHistoricalCandleResponse } from './market-candle-mapper.mjs';

export class MarketCandleProvider {
    async getHistoricalCandles() {
        throw new Error('Historical candle provider is not configured');
    }
}

export class MockMarketCandleProvider extends MarketCandleProvider {
    async getHistoricalCandles() {
        const response = {
            status: 'success',
            data: {
                candles: [
                    ['2026-10-23T09:15:00+05:30', 100, 105, 98, 103, 1200, 0],
                    ['2026-10-23T09:20:00+05:30', 103, 108, 101, 106, 1500, 0],
                    ['2026-10-23T09:25:00+05:30', 106, 109, 104, 107, 1350, 0],
                ],
            },
        };

        return mapHistoricalCandleResponse(response);
    }
}
