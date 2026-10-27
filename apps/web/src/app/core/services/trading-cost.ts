import { Service } from '@angular/core';

import {
    TradingCostConfig,
    TRADING_MARKETS
} from '../models/trading-cost.model';

export const ZERODHA_NSE_INTRADAY_COST_PROFILE: Readonly<TradingCostConfig> = Object.freeze({
    market: 'INDIAN_EQUITY_INTRADAY',
    profileId: 'ZERODHA_NSE_INTRADAY',
    exchange: 'NSE',
    broker: 'ZERODHA',
    brokeragePercent: 0.03,
    brokerageFixed: 20,
    sttPercent: 0.025,
    exchangeTransactionPercent: 0.00307,
    sebiChargesPercent: 0.0001,
    stampDutyPercent: 0.003,
    gstPercent: 18
});

@Service()
export class TradingCostService {

    validateConfig(config: TradingCostConfig): void {
        if (!config || typeof config !== 'object') {
            throw new Error('A trading cost configuration is required.');
        }

        if (!TRADING_MARKETS.includes(config.market)) {
            throw new Error(
                `Trading cost market "${config.market}" is not supported.`,
            );
        }

        if (
            config.profileId !== undefined &&
            config.profileId !== 'ZERODHA_NSE_INTRADAY'
        ) {
            throw new Error(
                `Trading cost profile "${config.profileId}" is not supported.`,
            );
        }

        const rates = [
            config.brokeragePercent,
            config.brokerageFixed,
            config.sttPercent,
            config.exchangeTransactionPercent,
            config.sebiChargesPercent,
            config.gstPercent,
            config.stampDutyPercent,
            config.spreadPercent,
            config.commissionPercent,
            config.swapPercent
        ];

        if (
            rates.some(
                rate =>
                    rate !== undefined &&
                    (!Number.isFinite(rate) || rate < 0),
            )
        ) {
            throw new Error(
                'Trading cost rates must be finite and non-negative.',
            );
        }

        const unsupportedForexRates = [
            config.spreadPercent,
            config.commissionPercent,
            config.swapPercent
        ];

        if (
            config.market === 'FOREX'
        ) {
            throw new Error(
                'FOREX costs are unsupported until fee semantics and broker-approved configuration are designed; no Forex charges have been applied.',
            );
        }

        if (config.market !== 'INDIAN_EQUITY_INTRADAY') {
            throw new Error(
                `Trading cost market "${config.market}" is not supported.`,
            );
        }

        if (
            config.market === 'INDIAN_EQUITY_INTRADAY' &&
            unsupportedForexRates.some(rate => rate !== undefined && rate > 0)
        ) {
            throw new Error(
                'FOREX spread, commission, and swap costs are not supported for Indian equity.',
            );
        }
    }

    calculate(
        config: TradingCostConfig,
        entryPrice: number,
        exitPrice: number,
        quantity: number
    ): number {
        this.validateConfig(config);

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

    validateBacktestConfig(config: TradingCostConfig): void {
        this.validateConfig(config);

        if (config.profileId !== ZERODHA_NSE_INTRADAY_COST_PROFILE.profileId) {
            throw new Error(
                'Backtesting requires the named ZERODHA_NSE_INTRADAY cost profile.',
            );
        }

        const requiredRates: Array<keyof TradingCostConfig> = [
            'brokeragePercent',
            'brokerageFixed',
            'sttPercent',
            'exchangeTransactionPercent',
            'sebiChargesPercent',
            'stampDutyPercent',
            'gstPercent'
        ];

        const missingRates = requiredRates.filter(
            rate => config[rate] === undefined
        );

        if (missingRates.length > 0) {
            throw new Error(
                `The ZERODHA_NSE_INTRADAY cost profile is incomplete. Missing: ${missingRates.join(', ')}.`,
            );
        }

        const profileFields: Array<keyof TradingCostConfig> = [
            'market',
            'exchange',
            'broker',
            ...requiredRates
        ];

        const profileMismatch = profileFields.some(
            field =>
                config[field] !== ZERODHA_NSE_INTRADAY_COST_PROFILE[field]
        );

        if (profileMismatch) {
            throw new Error(
                'Trading cost configuration does not match the named ZERODHA_NSE_INTRADAY profile.',
            );
        }
    }
}