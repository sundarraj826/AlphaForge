export interface MarketInstrument {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume?: number;
    currencyCode?: string;
}