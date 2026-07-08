import { Service, signal } from '@angular/core';
import { MarketTick } from '../models/market-tick.model';

@Service()
export class MarketService {

    private readonly _marketTicks = signal<MarketTick[]>([
        {
            symbol: 'RELIANCE',
            price: 150.25,
            change: 2.5,
            changePercent: 1.69,
            volume: 1000000
        },
        {
            symbol: 'TCS',
            price: 2800.75,
            change: -15.3,
            changePercent: -0.54,
            volume: 500000
        },
        {
            symbol: 'INFY',
            price: 3500.10,
            change: 20.5,
            changePercent: 0.59,
            volume: 750000
        }
    ]);

    readonly marketTicks = this._marketTicks.asReadonly();

}
