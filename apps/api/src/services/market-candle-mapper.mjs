
/**
 * Converts an Upstox-style candle array into AlphaForge's
 * standardized MarketCandle model.
 *
 * Candle format:
 * [timestamp, open, high, low, close, volume, openInterest?]
 */
export function mapHistoricalCandle(candle) {
    if (!Array.isArray(candle) || candle.length < 6) {
        throw new Error('Invalid historical candle format');
    }

    const [timestamp, open, high, low, close, volume] = candle;

    if (
        typeof timestamp !== 'string' ||
        !Number.isFinite(Date.parse(timestamp)) ||
        ![open, high, low, close, volume].every(Number.isFinite)
    ) {
        throw new Error('Invalid historical candle values');
    }

    if (
        high < low ||
        high < Math.max(open, close) ||
        low > Math.min(open, close) ||
        volume < 0
    ) {
        throw new Error('Historical candle OHLCV values are inconsistent');
    }

    return {
        timestamp: Date.parse(timestamp),
        open,
        high,
        low,
        close,
        volume,
    };
}

export function mapHistoricalCandles(candles) {
    if (!Array.isArray(candles)) {
        throw new Error('Historical candles must be an array');
    }

    return candles.map(mapHistoricalCandle);
}


export function mapHistoricalCandleResponse(response) {
    if (
        !response ||
        response.status !== 'success' ||
        !response.data ||
        !Array.isArray(response.data.candles)
    ) {
        throw new Error('Invalid historical candle API response');
    }

    return mapHistoricalCandles(response.data.candles);
}

