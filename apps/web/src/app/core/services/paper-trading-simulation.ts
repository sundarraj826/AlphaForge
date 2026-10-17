
import { inject, Service } from '@angular/core';

import { MarketCandle } from '../models/market-candle.model';
import { PositionSide } from '../models/position-side.model';
import { Strategy } from '../models/strategy.model';
import { PaperTradingSimulationResult } from '../models/paper-trading-simulation-result.model';

import { PaperTradingRunnerService } from './paper-trading-runner';
import { PaperTradingService } from './paper-trading';

@Service()
export class PaperTradingSimulationService {

    private readonly _runner = inject(PaperTradingRunnerService);
    private readonly _paperTradingService = inject(PaperTradingService);

    run(
        strategy: Strategy,
        candles: MarketCandle[],
        initialCapital: number = 100000
    ): PaperTradingSimulationResult {

        this._paperTradingService.reset(initialCapital);

        const startingCapital = this._paperTradingService.capital;

        let positionSide: PositionSide = 'NONE';

        for (let index = 0; index < candles.length; index++) {
            const candleHistory = candles.slice(0, index + 1);

            const signal = this._runner.run(
                strategy,
                candleHistory,
                positionSide
            );

            if (signal === 'BUY' && positionSide === 'NONE') {
                positionSide = 'LONG';
            } else if (signal === 'SELL' && positionSide === 'LONG') {
                positionSide = 'NONE';
            }
        }

        const trades = this._paperTradingService.trades;

        const winningTrades = trades.filter(
            trade => trade.profitLoss > 0
        ).length;

        const losingTrades = trades.filter(
            trade => trade.profitLoss < 0
        ).length;

        const finalCapital = this._paperTradingService.capital;

        return {
            initialCapital: startingCapital,
            finalCapital,
            totalProfitLoss: finalCapital - startingCapital,
            totalTrades: trades.length,
            winningTrades,
            losingTrades,
            winRate: trades.length > 0
                ? (winningTrades / trades.length) * 100
                : 0
        };
    }
}
