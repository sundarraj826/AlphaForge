export type TradingMarket =
    | 'INDIAN_EQUITY_INTRADAY'
    | 'INDIAN_EQUITY_DELIVERY'
    | 'INDIAN_FNO'
    | 'FOREX'
    | 'CRYPTO';

export const TRADING_MARKETS: readonly TradingMarket[] = [
    'INDIAN_EQUITY_INTRADAY',
    'INDIAN_EQUITY_DELIVERY',
    'INDIAN_FNO',
    'FOREX',
    'CRYPTO'
];

export type TradingCostProfileId = 'ZERODHA_NSE_INTRADAY';

export type TradingExchange =
    | 'NSE'
    | 'BSE'
    | 'MT5';

export type TradingBroker =
    | 'ZERODHA'
    | 'OTHER';

export interface TradingCostConfig {
    market: TradingMarket;
    profileId?: TradingCostProfileId;
    exchange?: TradingExchange;
    broker?: TradingBroker;

    brokeragePercent?: number;
    brokerageFixed?: number;

    sttPercent?: number;
    exchangeTransactionPercent?: number;
    sebiChargesPercent?: number;
    gstPercent?: number;
    stampDutyPercent?: number;

    spreadPercent?: number;
    commissionPercent?: number;
    swapPercent?: number;
}