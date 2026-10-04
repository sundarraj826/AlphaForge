import { Service, signal } from '@angular/core';
import { MarketCandle } from '../models/market-candle.model';

@Service()
export class MarketHistoryService {

    private readonly _candles = signal<MarketCandle[]>([
        {
            timestamp: 1,
            open: 100,
            high: 103,
            low: 99,
            close: 100,
            volume: 1000
        },
        {
            timestamp: 2,
            open: 100,
            high: 104,
            low: 99,
            close: 102,
            volume: 1200
        },
        {
            timestamp: 3,
            open: 102,
            high: 103,
            low: 100,
            close: 101,
            volume: 1100
        },
        {
            timestamp: 4,
            open: 101,
            high: 106,
            low: 100,
            close: 105,
            volume: 1500
        },
        {
            timestamp: 5,
            open: 105,
            high: 108,
            low: 104,
            close: 107,
            volume: 1600
        }
    ]);

    readonly candles = this._candles.asReadonly();

    // This method returns the current list of market candles.
    getCandles(): MarketCandle[] {
        return this._candles();
    }
}