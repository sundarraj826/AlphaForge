import { Service, inject } from '@angular/core';

import { BacktestResult } from '../models/backtest-result.model';
import { MarketCandle } from '../models/market-candle.model';
import { Strategy } from '../models/strategy.model';
import { BacktestTrade } from '../models/backtest-trade.model';

import { StrategyService } from './strategy';
import { TradingCostService } from './trading-cost';
import { TradingCostConfig } from '../models/trading-cost.model';
import { PositionSizingService } from './position-sizing';

@Service()
export class BacktestingService {

    readonly strategyService = inject(StrategyService);
    readonly tradingCostService = inject(TradingCostService);
    readonly positionSizingService = inject(PositionSizingService);

    runBacktest(
        strategy: Strategy,
        candles: MarketCandle[],
        quantity: number = 1,
        initialCapital: number = 100000,
        slippagePercent: number = 0,
        startTimestamp?: number,
        endTimestamp?: number,
        riskPercent: number = 0
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

        const tradingCostConfig: TradingCostConfig = {
            market: 'INDIAN_EQUITY_INTRADAY',
            exchange: 'NSE',
            broker: 'ZERODHA',
            brokeragePercent: 0.03,
            brokerageFixed: 20,
            sttPercent: 0.025,
            exchangeTransactionPercent: 0.00307,
            sebiChargesPercent: 0.0001,
            stampDutyPercent: 0.003,
            gstPercent: 18
        };


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

            const maxDailyLossPercent =
                strategy.riskManagement?.maxDailyLossPercent ?? 0;

            const maxDailyLoss =
                initialCapital * (maxDailyLossPercent / 100);

            const dailyLoss =
                totalProfitLoss < 0
                    ? Math.abs(totalProfitLoss)
                    : 0;

            if (
                positionSide === 'NONE' &&
                maxDailyLoss > 0 &&
                dailyLoss >= maxDailyLoss
            ) {
                continue;
            }


            if (positionSide === 'NONE' && signal === 'BUY') {
                const slippage =
                    candle.close * (slippagePercent / 100);

                entryPrice = candle.close + slippage;

                if (riskPercent > 0) {
                    const stopLossPercent =
                        strategy.riskManagement?.stopLossPercent ?? 0;

                    const stopLossPrice =
                        stopLossPercent > 0
                            ? entryPrice * (1 - stopLossPercent / 100)
                            : entryPrice;

                    quantity = this.positionSizingService.calculateQuantity(
                        finalCapital,
                        riskPercent,
                        entryPrice,
                        stopLossPrice
                    );
                }

                if (quantity <= 0) {
                    entryPrice = 0;
                    continue;
                }

                positionSide = 'LONG';

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
                        this.tradingCostService.calculate(
                            tradingCostConfig,
                            entryPrice,
                            exitPrice,
                            quantity
                        );

                    const profitLoss =
                        grossProfitLoss - fee;

                    totalFees += fee;

                    totalTrades++;
                    totalProfitLoss += profitLoss;
                    finalCapital = initialCapital + totalProfitLoss;
                    equityCurve.push(finalCapital);

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
                        this.tradingCostService.calculate(
                            tradingCostConfig,
                            entryPrice,
                            exitPrice,
                            quantity
                        );

                    const profitLoss =
                        grossProfitLoss - fee;

                    totalFees += fee;

                    totalTrades++;
                    totalProfitLoss += profitLoss;

                    finalCapital = initialCapital + totalProfitLoss;

                    equityCurve.push(finalCapital);

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
                        this.tradingCostService.calculate(
                            tradingCostConfig,
                            entryPrice,
                            exitPrice,
                            quantity
                        );

                    const profitLoss =
                        grossProfitLoss - fee;

                    totalFees += fee;

                    totalTrades++;
                    totalProfitLoss += profitLoss;

                    finalCapital = initialCapital + totalProfitLoss;

                    equityCurve.push(finalCapital);

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