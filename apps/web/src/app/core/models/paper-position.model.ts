export interface PaperPosition {
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedProfitLoss: number;
    openedAt: number;
}