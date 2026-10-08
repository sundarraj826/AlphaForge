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
        candles: MarketCandle[]
    ): PaperTradingSimulationResult {

        const initialCapital = this._paperTradingService.capital;

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
            }

            if (signal === 'SELL' && positionSide === 'LONG') {
                positionSide = 'NONE';
            }
        }

        return {
            initialCapital,
            finalCapital: this._paperTradingService.capital,
            totalProfitLoss:
                this._paperTradingService.capital - initialCapital,
            totalTrades: this._paperTradingService.trades.length,
            winningTrades: this._paperTradingService.trades.filter(
                trade => trade.profitLoss > 0
            ).length,
            losingTrades: this._paperTradingService.trades.filter(
                trade => trade.profitLoss < 0
            ).length,
            winRate:
                this._paperTradingService.trades.length > 0
                    ? (
                        this._paperTradingService.trades.filter(
                            trade => trade.profitLoss > 0
                        ).length /
                        this._paperTradingService.trades.length
                    ) * 100
                    : 0
        };
    }
}