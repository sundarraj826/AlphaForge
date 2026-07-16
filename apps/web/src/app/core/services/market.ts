import { Service, signal } from '@angular/core';
import { MarketInstrument } from '../models/market-instrument.model';

@Service()
export class MarketService {

    private readonly _marketInstrument = signal<MarketInstrument[]>([
        {
            symbol: 'XAU/USD',
            price: 150.25,
            change: 2.5,
            changePercent: 1.69,
            volume: 1000000,
            currencyCode: 'USD'
        },
        {
            symbol: 'TCS',
            price: 2800.75,
            change: -15.3,
            changePercent: -0.54,
            volume: 500000,
            currencyCode: 'INR'
        },
        {
            symbol: 'BTC/USD',
            price: 3500.10,
            change: 20.5,
            changePercent: 0.59,
            volume: 750000,
            currencyCode: 'USD'
        }
    ]);

    readonly marketInstruments = this._marketInstrument.asReadonly();

}
