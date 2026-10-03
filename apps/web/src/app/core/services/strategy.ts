import { Service, signal } from '@angular/core';
import { Strategy } from '../models/strategy.model';

@Service()
export class StrategyService {

    private readonly _strategies = signal<Strategy[]>([
        {
            id: '1',
            name: 'Gold EMA Cross',
            instrument: 'XAU/USD',
            timeframe: '15m',
            status: 'Active'
        },
        {
            id: '2',
            name: 'BTC Breakout',
            instrument: 'BTC/USD',
            timeframe: '1H',
            status: 'Inactive'
        },
        {
            id: '3',
            name: 'Nifty Swing',
            instrument: 'NIFTY50',
            timeframe: '1D',
            status: 'Active'
        }
    ]);

    addStrategy(strategy: Strategy) {

    }

    readonly strategies = this._strategies.asReadonly();
}
