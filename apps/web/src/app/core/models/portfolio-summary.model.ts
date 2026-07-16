export interface PortfolioSummary {
    instrument: string;
    quantity: number;
    averageEntry: number;
    marketPrice: number;
    currencyCode: string;

    invested: number;
    currentValue: number;
    pl: number;
    plPercentage: number;
}