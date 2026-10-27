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
    openPosition: {
        side: 'LONG';
        entryPrice: number;
        quantity: number;
        markPrice: number;
        markTimestamp: number;
        unrealizedGrossProfitLoss: number;
    } | null;
    equityCurve: number[];

    drawdownCurve: number[];
    maxDrawdown: number;
    maxDrawdownPercent: number;

    trades: BacktestTrade[];
}