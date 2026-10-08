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

    calculateLatestEma(
        candles: MarketCandle[],
        period: number
    ): number | null {
        const emaValues = this.calculateEmaFromCandles(candles, period);

        return emaValues.length > 0
            ? emaValues[emaValues.length - 1]
            : null;
    }

    calculateAtr(
        candles: MarketCandle[],
        period: number
    ): number | null {
        if (
            candles.length < period + 1 ||
            period <= 0
        ) {
            return null;
        }

        const trueRanges: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const currentCandle = candles[i];
            const previousCandle = candles[i - 1];

            const trueRange = Math.max(
                currentCandle.high - currentCandle.low,
                Math.abs(
                    currentCandle.high - previousCandle.close
                ),
                Math.abs(
                    currentCandle.low - previousCandle.close
                )
            );

            trueRanges.push(trueRange);
        }

        if (trueRanges.length < period) {
            return null;
        }

        const recentTrueRanges =
            trueRanges.slice(-period);

        const atr =
            recentTrueRanges.reduce(
                (sum, trueRange) => sum + trueRange,
                0
            ) / period;

        return atr;
    }

    calculateAverageVolume(
        candles: MarketCandle[],
        period: number
    ): number | null {
        if (
            period <= 0 ||
            candles.length < period
        ) {
            return null;
        }

        const recentCandles = candles.slice(-period);

        const totalVolume = recentCandles.reduce(
            (sum, candle) => sum + (candle.volume ?? 0),
            0
        );

        return totalVolume / period;
    }

    // This method checks if the current price is above the latest EMA value.
    isPriceAboveEma(
        candles: MarketCandle[],
        period: number
    ): boolean {
        const latestEma = this.calculateLatestEma(candles, period);

        if (latestEma === null || candles.length === 0) {
            return false;
        }

        const currentPrice = candles[candles.length - 1].close;

        return currentPrice > latestEma;
    }
}
