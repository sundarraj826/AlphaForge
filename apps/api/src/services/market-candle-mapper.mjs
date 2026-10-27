
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
        !Number.isFinite(volume)
    ) {
        throw new Error('Invalid historical candle values');
    }

    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
            timestamp,
        )
    ) {
        throw new Error(
            'Historical candle timestamp must be an ISO datetime with an explicit timezone (Z or ±HH:MM)',
        );
    }

    if (!Number.isFinite(Date.parse(timestamp))) {
        throw new Error('Invalid historical candle values');
    }

    const prices = [open, high, low, close];

    if (
        !prices.every(Number.isFinite) ||
        prices.some(price => price <= 0)
    ) {
        throw new Error(
            'Historical candle OHLC prices must be finite and greater than zero',
        );
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

    const mappedCandles = candles.map(mapHistoricalCandle);
    const timestamps = new Set();

    for (const candle of mappedCandles) {
        if (timestamps.has(candle.timestamp)) {
            throw new Error(
                `Duplicate historical candle timestamp: ${candle.timestamp}`,
            );
        }

        timestamps.add(candle.timestamp);
    }

    return mappedCandles;
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
