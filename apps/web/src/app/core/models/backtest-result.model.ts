import { BacktestTrade } from './backtest-trade.model';

export interface BacktestResult {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    grossProfit: number;
    grossLoss: number;
    profitFactor: number;
    totalProfitLoss: number;
    totalFees: number;
    initialCapital: number;
    finalCapital: number;
    equityCurve: number[];

    drawdownCurve: number[];
    maxDrawdown: number;
    maxDrawdownPercent: number;

    trades: BacktestTrade[];
}