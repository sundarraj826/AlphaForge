import { Service, signal, computed } from '@angular/core';
import { PortfolioHolding } from '../models/portfolio-holding.model';
import { PortfolioSummary } from '../models/portfolio-summary.model';

@Service()
export class PortfolioService {

    private readonly _portfolioHoldings = signal<PortfolioHolding[]>([
        {
            instrument: 'XAU/USD',
            quantity: 2,
            averageEntry: 2350,
            marketPrice: 2375,
            currencyCode: 'USD'
        },
        {
            instrument: 'RELIANCE',
            quantity: 20,
            averageEntry: 2800,
            marketPrice: 2850,
            currencyCode: 'INR'
        },
        {
            instrument: 'BTC/USD',
            quantity: 1,
            averageEntry: 65000,
            marketPrice: 68000,
            currencyCode: 'USD'
        }
    ]);

    readonly portfolioItems = computed<PortfolioSummary[]>(() =>
        this._portfolioHoldings().map(holding => {
            const invested = holding.quantity * holding.averageEntry;
            const currentValue = holding.quantity * holding.marketPrice;
            const pl = currentValue - invested;
            const plPercentage = invested ? (pl / invested) * 100 : 0;

            return {
                ...holding,
                invested,
                currentValue,
                pl,
                plPercentage
            };
        })

    );
}
