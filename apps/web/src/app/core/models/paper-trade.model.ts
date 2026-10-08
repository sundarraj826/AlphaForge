export interface PaperTrade {
    symbol: string;
    quantity: number;
    entryPrice: number;
    exitPrice: number;
    profitLoss: number;
    openedAt: number;
    closedAt: number;
}