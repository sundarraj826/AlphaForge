export interface RiskManagement {
    riskPerTrade: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    maxDailyLossPercent: number;
    maxOpenTrades: number;

    emaFastPeriod?: number;
    emaSlowPeriod?: number;
    volumePeriod?: number;
    volumeMultiplier?: number;
    atrPeriod?: number;
    atrMultiplier?: number;
    rewardRiskRatio?: number;
}