export type PaperOrderSide = 'BUY' | 'SELL';

export type PaperOrderStatus =
    | 'PENDING'
    | 'FILLED'
    | 'CANCELLED';

export interface PaperOrder {
    id: string;
    symbol: string;
    side: PaperOrderSide;
    quantity: number;
    requestedPrice: number;
    fillPrice: number;
    status: PaperOrderStatus;
    createdAt: number;
    filledAt?: number;
}