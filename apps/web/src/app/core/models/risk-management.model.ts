export interface RiskManagement {
    riskPerTrade: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLossPercent: number;
    maxOpenTrades: number;
}