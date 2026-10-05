import { Service, inject } from '@angular/core';

import { BacktestResult } from '../models/backtest-result.model';
import { MarketCandle } from '../models/market-candle.model';
import { Strategy } from '../models/strategy.model';
import { BacktestTrade } from '../models/backtest-trade.model';

import { StrategyService } from './strategy';
import { TradingCostService } from './trading-cost';

@Service()
export class BacktestingService {

    readonly strategyService = inject(StrategyService);
    readonly tradingCostService = inject(TradingCostService);

    runBacktest(
        strategy: Strategy,
        candles: MarketCandle[],
        quantity: number = 1,
        initialCapital: number = 100000,
        feePercent: number = 0,
        slippagePercent: number = 0,
        startTimestamp?: number,
        endTimestamp?: number
    ): BacktestResult {

        const filteredCandles = candles.filter(candle => {
            if (
                startTimestamp !== undefined &&
                candle.timestamp < startTimestamp
            ) {
                return false;
            }

            if (
                endTimestamp !== undefined &&
                candle.timestamp > endTimestamp
            ) {
                return false;
            }

            return true;
        });


        let positionSide: 'LONG' | 'NONE' = 'NONE';
        let entryPrice = 0;

        let totalTrades = 0;
        let winningTrades = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let losingTrades = 0;
        let totalProfitLoss = 0;
        let totalFees = 0;
        let finalCapital = initialCapital;

        const equityCurve: number[] = [initialCapital];
        const drawdownCurve: number[] = [];

        let peakEquity = initialCapital;
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;

        const trades: BacktestTrade[] = [];

        for (let i = 0; i < filteredCandles.length; i++) {

            const candle = filteredCandles[i];

            const candleHistory = filteredCandles.slice(0, i + 1);

            const signal = this.strategyService.evaluateStrategy(
                strategy,
                candleHistory,
                positionSide
            );

            if (positionSide === 'NONE' && signal === 'BUY') {
                positionSide = 'LONG';

                const slippage =
                    candle.close * (slippagePercent / 100);

                entryPrice = candle.close + slippage;

                continue;
            }

            if (positionSide === 'LONG') {

                const stopLossPercent =
                    strategy.riskManagement?.stopLossPercent ?? 0;

                const stopLossPrice =
                    stopLossPercent > 0
                        ? entryPrice * (1 - stopLossPercent / 100)
                        : null;

                if (
                    stopLossPrice !== null &&
                    candle.low <= stopLossPrice
                ) {
                    const slippage = stopLossPrice * (slippagePercent / 100);
                    const exitPrice = stopLossPrice - slippage;

                    const grossProfitLoss =
                        (exitPrice - entryPrice) * quantity;

                    if (grossProfitLoss > 0) {
                        grossProfit += grossProfitLoss;
                    } else {
                        grossLoss += Math.abs(grossProfitLoss);
                    }


                    const tradeValue =
                        (entryPrice + exitPrice) * quantity;

                    const fee =
                        tradeValue * (feePercent / 100);

                    const profitLoss =
                        grossProfitLoss - fee;

                    totalFees += fee;

                    totalTrades++;
                    totalProfitLoss += profitLoss;
                    equityCurve.push(initialCapital + totalProfitLoss);

                    if (profitLoss > 0) {
                        winningTrades++;
                    } else {
                        losingTrades++;
                    }

                    trades.push({
                        entryPrice,
                        exitPrice,
                        quantity,
                        profitLoss
                    });

                    positionSide = 'NONE';
                    entryPrice = 0;

                    continue;
                }

                const takeProfitPercent =
                    strategy.riskManagement?.takeProfitPercent ?? 0;

                const takeProfitPrice =
                    takeProfitPercent > 0
                        ? entryPrice * (1 + takeProfitPercent / 100)
                        : null;

                if (
                    takeProfitPrice !== null &&
                    candle.high >= takeProfitPrice
                ) {
                    const slippage =
                        takeProfitPrice * (slippagePercent / 100);

                    const exitPrice =
                        takeProfitPrice - slippage;

                    const grossProfitLoss =
                        (exitPrice - entryPrice) * quantity;

                    if (grossProfitLoss > 0) {
                        grossProfit += grossProfitLoss;
                    } else {
                        grossLoss += Math.abs(grossProfitLoss);
                    }

                    const tradeValue =
                        (entryPrice + exitPrice) * quantity;

                    const fee =
                        tradeValue * (feePercent / 100);

                    const profitLoss =
                        grossProfitLoss - fee;

                    totalFees += fee;

                    totalTrades++;
                    totalProfitLoss += profitLoss;
                    equityCurve.push(initialCapital + totalProfitLoss);

                    if (profitLoss > 0) {
                        winningTrades++;
                    } else {
                        losingTrades++;
                    }

                    trades.push({
                        entryPrice,
                        exitPrice,
                        quantity,
                        profitLoss
                    });

                    positionSide = 'NONE';
                    entryPrice = 0;

                    continue;
                }

                if (signal === 'SELL') {
                    const slippage =
                        candle.close * (slippagePercent / 100);

                    const exitPrice =
                        candle.close - slippage;

                    const grossProfitLoss =
                        (exitPrice - entryPrice) * quantity;

                    if (grossProfitLoss > 0) {
                        grossProfit += grossProfitLoss;
                    } else {
                        grossLoss += Math.abs(grossProfitLoss);
                    }

                    const tradeValue =
                        (entryPrice + exitPrice) * quantity;

                    const fee =
                        tradeValue * (feePercent / 100);

                    const profitLoss =
                        grossProfitLoss - fee;

                    totalFees += fee;

                    totalTrades++;
                    totalProfitLoss += profitLoss;
                    equityCurve.push(initialCapital + totalProfitLoss);

                    if (profitLoss > 0) {
                        winningTrades++;
                    } else {
                        losingTrades++;
                    }

                    trades.push({
                        entryPrice,
                        exitPrice,
                        quantity,
                        profitLoss
                    });

                    positionSide = 'NONE';
                    entryPrice = 0;
                }
            }
        }

        const winRate =
            totalTrades > 0
                ? (winningTrades / totalTrades) * 100
                : 0;

        const profitFactor =
            grossLoss > 0
                ? grossProfit / grossLoss
                : grossProfit > 0
                    ? Infinity
                    : 0;

        finalCapital = initialCapital + totalProfitLoss;

        for (const equity of equityCurve) {
            if (equity > peakEquity) {
                peakEquity = equity;
            }

            const drawdown = peakEquity - equity;

            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;

                maxDrawdownPercent =
                    peakEquity > 0
                        ? (drawdown / peakEquity) * 100
                        : 0;
            }
        }

        let peak = initialCapital;

        for (const equity of equityCurve) {
            if (equity > peak) {
                peak = equity;
            }

            drawdownCurve.push(peak - equity);
        }

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            grossProfit,
            grossLoss,
            profitFactor,
            totalProfitLoss,
            totalFees,
            initialCapital,
            finalCapital,
            equityCurve,
            drawdownCurve,
            maxDrawdown,
            maxDrawdownPercent,
            trades
        };
    }
}