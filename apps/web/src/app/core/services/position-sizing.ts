import { Service } from '@angular/core';

@Service()
export class PositionSizingService {

    calculateQuantity(
        capital: number,
        riskPercent: number,
        entryPrice: number,
        stopLossPrice: number
    ): number {

        if (
            capital <= 0 ||
            riskPercent <= 0 ||
            entryPrice <= 0 ||
            stopLossPrice <= 0
        ) {
            return 0;
        }

        const riskAmount = capital * (riskPercent / 100);

        const riskPerShare = Math.abs(entryPrice - stopLossPrice);

        if (riskPerShare === 0) {
            return 0;
        }

        const riskBasedQuantity = Math.floor(
            riskAmount / riskPerShare
        );

        const capitalBasedQuantity = Math.floor(
            capital / entryPrice
        );

        return Math.min(
            riskBasedQuantity,
            capitalBasedQuantity
        );
    }


}
