import { Service, signal } from '@angular/core';
import { Strategy } from '../models/strategy.model';

@Service()
export class StrategyService {

    private readonly _strategies = signal<Strategy[]>([
        {
            name: 'Gold EMA Cross',
            instrument: 'XAU/USD',
            timeframe: '15m',
            status: 'Active'
        },
        {
            name: 'BTC Breakout',
            instrument: 'BTC/USD',
            timeframe: '1h',
            status: 'Inactive'
        },
        {
            name: 'Nifty Swing',
            instrument: 'NIFTY50',
            timeframe: '1D',
            status: 'Active'
        }
    ]);

    readonly strategies = this._strategies.asReadonly();
}
