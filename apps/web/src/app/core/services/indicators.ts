import { Service } from '@angular/core';
import { MarketCandle } from '../models/market-candle.model';

@Service()
export class IndicatorService {

    calculateEma(prices: number[], period: number): number[] {
        if (prices.length === 0 || period <= 0) {
            return [];
        }

        if (prices.length < period) {
            return [];
        }

        const multiplier = 2 / (period + 1);
        const ema: number[] = [];

        // First EMA = SMA of the first `period` prices
        const firstPeriodPrices = prices.slice(0, period);
        const firstSma =
            firstPeriodPrices.reduce((sum, price) => sum + price, 0) / period;

        ema.push(firstSma);

        // Calculate remaining EMA values
        for (let i = period; i < prices.length; i++) {
            const previousEma = ema[ema.length - 1];

            const currentEma =
                (prices[i] - previousEma) * multiplier + previousEma;

            ema.push(currentEma);
        }

        return ema;
    }

    calculateEmaFromCandles(
        candles: MarketCandle[],
        period: number
    ): number[] {
        const closingPrices = candles.map(candle => candle.close);

        return this.calculateEma(closingPrices, period);
    }

    testEmaFromCandles(): void {
        const candles: MarketCandle[] = [
            {
                timestamp: 1,
                open: 100,
                high: 103,
                low: 99,
                close: 100
            },
            {
                timestamp: 2,
                open: 100,
                high: 104,
                low: 99,
                close: 102
            },
            {
                timestamp: 3,
                open: 102,
                high: 103,
                low: 100,
                close: 101
            },
            {
                timestamp: 4,
                open: 101,
                high: 106,
                low: 100,
                close: 105
            },
            {
                timestamp: 5,
                open: 105,
                high: 108,
                low: 104,
                close: 107
            }
        ];

        const ema = this.calculateEmaFromCandles(candles, 3);

        console.log('EMA from candles:', ema);
    }
}
