export interface PaperTradingSimulationResult {
    initialCapital: number;
    finalCapital: number;
    totalProfitLoss: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
}