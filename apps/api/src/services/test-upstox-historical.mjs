
import 'dotenv/config';

import {
    UpstoxHistoricalCandleProvider,
} from './upstox-historical-candle-provider.mjs';

const provider = new UpstoxHistoricalCandleProvider();

try {
    const candles = await provider.getHistoricalCandles({
        instrumentKey: 'NSE_INDEX|Nifty 50',
        unit: 'minutes',
        interval: 5,
        fromDate: '2026-10-26',
        toDate: '2026-10-26',
    });

    console.log('Historical API request succeeded.');
    console.log('Candle count:', candles.length);
    console.log('First candle:', candles[0] ?? 'No candles returned');
} catch (error) {
    console.error('Historical API test failed:', error.message);
    process.exitCode = 1;
}
