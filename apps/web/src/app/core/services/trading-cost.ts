import { Service } from '@angular/core';

import {
    TradingCostConfig
} from '../models/trading-cost.model';

@Service()
export class TradingCostService {

    calculate(
        config: TradingCostConfig,
        entryPrice: number,
        exitPrice: number,
        quantity: number
    ): number {

        const entryValue = entryPrice * quantity;
        const exitValue = exitPrice * quantity;

        const buyTurnover = entryValue;
        const sellTurnover = exitValue;
        const totalTurnover = buyTurnover + sellTurnover;

        const brokeragePercent =
            config.brokeragePercent ?? 0;

        const brokerageFixed =
            config.brokerageFixed ?? 0;

        const buyBrokerage = Math.min(
            buyTurnover * brokeragePercent / 100,
            brokerageFixed
        );

        const sellBrokerage = Math.min(
            sellTurnover * brokeragePercent / 100,
            brokerageFixed
        );

        const brokerage =
            buyBrokerage + sellBrokerage;

        const stt =
            Math.round(
                sellTurnover *
                (config.sttPercent ?? 0) /
                100
            );

        const exchangeTransactionCharges =
            totalTurnover *
            (config.exchangeTransactionPercent ?? 0) /
            100;

        const sebiCharges =
            totalTurnover *
            (config.sebiChargesPercent ?? 0) /
            100;

        const stampDuty =
            buyTurnover *
            (config.stampDutyPercent ?? 0) /
            100;

        const gst =
            (
                brokerage +
                exchangeTransactionCharges +
                sebiCharges
            ) *
            (config.gstPercent ?? 0) /
            100;

        return (
            brokerage +
            stt +
            exchangeTransactionCharges +
            sebiCharges +
            stampDuty +
            gst
        );
    }
}