import test from 'node:test';
import assert from 'node:assert/strict';

import {
    loadSandboxOrderRiskConfig,
    OrderRiskConfigurationError,
    validateSandboxOrderRiskConfig,
} from './order-risk.config.mjs';

const validEnvironment = {
    UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS: 'NSE_EQ|INE669E01016,NSE_INDEX|Nifty 50',
    UPSTOX_SANDBOX_MAX_ORDER_QUANTITY: '100',
    UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL: '250000',
};

test('loads a strict Sandbox order risk configuration', () => {
    assert.deepEqual(loadSandboxOrderRiskConfig(validEnvironment), {
        allowedInstruments: ['NSE_EQ|INE669E01016', 'NSE_INDEX|Nifty 50'],
        maxQuantity: 100,
        maxNotional: '250000',
    });
});

test('rejects missing and malformed risk configuration values', () => {
    for (const [key, value] of [
        ['UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS', undefined],
        ['UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS', ' , '],
        ['UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS', 'NSE_EQ|A,NSE_EQ|A'],
        ['UPSTOX_SANDBOX_MAX_ORDER_QUANTITY', undefined],
        ['UPSTOX_SANDBOX_MAX_ORDER_QUANTITY', '0'],
        ['UPSTOX_SANDBOX_MAX_ORDER_QUANTITY', '-1'],
        ['UPSTOX_SANDBOX_MAX_ORDER_QUANTITY', '1.5'],
        ['UPSTOX_SANDBOX_MAX_ORDER_QUANTITY', '9007199254740992'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', undefined],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', '0'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', '-1'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', 'Infinity'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', '1e5'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', '0.0000001'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', '1000000000000000'],
        ['UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL', ''],
    ]) {
        const environment = { ...validEnvironment };
        if (value === undefined) {
            delete environment[key];
        } else {
            environment[key] = value;
        }

        assert.throws(
            () => loadSandboxOrderRiskConfig(environment),
            OrderRiskConfigurationError,
        );
    }
});

test('rejects invalid risk configuration objects', () => {
    for (const config of [
        null,
        { allowedInstruments: [], maxQuantity: 1, maxNotional: 1 },
        { allowedInstruments: ['NSE_EQ|A', 'NSE_EQ|A'], maxQuantity: 1, maxNotional: 1 },
        { allowedInstruments: ['NSE_EQ|A'], maxQuantity: 0, maxNotional: 1 },
        { allowedInstruments: ['NSE_EQ|A'], maxQuantity: 1.5, maxNotional: 1 },
        { allowedInstruments: ['NSE_EQ|A'], maxQuantity: 1, maxNotional: 0 },
        { allowedInstruments: ['NSE_EQ|A'], maxQuantity: 1, maxNotional: Infinity },
    ]) {
        assert.throws(
            () => validateSandboxOrderRiskConfig(config),
            OrderRiskConfigurationError,
        );
    }
});
