import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    NIFTY50_PAPER_STRATEGY_CONFIG,
} from '../config/nifty50-paper-strategy.config.mjs';
import { createPaperProposalStore } from '../storage/paper-proposal.store.mjs';
import {
    createPaperProposalGenerationService,
    PaperProposalGenerationError,
} from './paper-proposal-generation.service.mjs';

const CANDLE_DURATION_MS = 15 * 60_000;
const EVALUATION_TIME = Date.parse('2026-10-27T22:00:05+05:30');
const START_TIME = EVALUATION_TIME -
    NIFTY50_PAPER_STRATEGY_CONFIG.evaluation.finalizationDelayMs -
    50 * CANDLE_DURATION_MS;
const calendarPolicy = {
    getCandleEndTime: ({ candleStartTime, nominalDurationMs }) =>
        candleStartTime + nominalDurationMs,
};
const candleFinalityPolicy = {
    areFinalized: async () => true,
};

function createCandles() {
    const candles = Array.from({ length: 50 }, (_, index) => {
        const close = 100 + index;
        return {
            timestamp: START_TIME + index * CANDLE_DURATION_MS,
            open: close - 0.5,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1000,
        };
    });
    candles[candles.length - 1] = {
        ...candles.at(-1),
        open: 148.5,
        high: 151,
        low: 148,
        close: 150,
        volume: 1500,
    };
    return candles;
}

function createProvider(candles = createCandles()) {
    const calls = [];
    return {
        calls,
        getHistoricalCandles: async options => {
            calls.push(options);
            return candles;
        },
    };
}

function createStore() {
    return {
        insert: proposal => ({
            created: true,
            proposal: {
                proposalId: 'a'.repeat(64),
                strategyId: proposal.strategyId,
                strategyVersion: proposal.strategyVersion,
                instrument: proposal.instrument,
                signal: proposal.side,
                candleTimestamp: proposal.signalTimestamp,
                createdAt: proposal.evaluatedAt,
                payload: proposal,
            },
        }),
    };
}

function createService({
    candles = createCandles(),
    provider = createProvider(candles),
    store = createStore(),
    clock = () => EVALUATION_TIME,
    calendar = calendarPolicy,
    finality = candleFinalityPolicy,
} = {}) {
    return {
        provider,
        store,
        service: createPaperProposalGenerationService({
            historicalCandleProvider: provider,
            proposalStore: store,
            clock,
            calendarPolicy: calendar,
            candleFinalityPolicy: finality,
        }),
    };
}

async function assertGenerationError(service, message) {
    await assert.rejects(
        service.generateAndPersist(),
        error => {
            assert.ok(error instanceof PaperProposalGenerationError);
            assert.equal(error.message, message);
            return true;
        },
    );
}

test('fetches sufficient NIFTY50 history and persists an eligible proposal', async () => {
    const { provider, service } = createService();
    const result = await service.generateAndPersist();

    assert.deepEqual(provider.calls, [{
        instrumentKey: 'NSE_INDEX|Nifty 50',
        unit: 'minutes',
        interval: 15,
        fromDate: '2026-09-27',
        toDate: '2026-10-27',
    }]);
    assert.equal(result.status, 'PERSISTED');
    assert.equal(result.created, true);
    assert.equal(result.proposal.payload.status, 'PAPER_PROPOSAL');
    assert.equal(result.proposal.payload.side, 'BUY');
    assert.equal(result.proposal.payload.execution.status, 'UNAVAILABLE');
    assert.equal(result.proposal.payload.execution.riskCheck, 'NOT_EVALUATED');
});

test('passes the full candle batch, evaluation time, and timeframe to finality policy', async () => {
    const candles = createCandles();
    let finalityArguments;
    const { service } = createService({
        candles,
        finality: {
            async areFinalized(arguments_) {
                finalityArguments = arguments_;
                return true;
            },
        },
    });

    await service.generateAndPersist();

    assert.deepEqual(finalityArguments, {
        candles,
        evaluationTime: EVALUATION_TIME,
        timeframe: '15m',
    });
    assert.equal(finalityArguments.candles.at(-1), candles.at(-1));
});

for (const [date, expectedFromDate] of [
    ['2024-03-31T22:00:05+05:30', '2024-02-29'],
    ['2025-03-31T22:00:05+05:30', '2025-02-28'],
]) {
    test(`clamps the one-month range at month end for ${date.slice(0, 4)}`, async () => {
        const calls = [];
        const provider = {
            async getHistoricalCandles(options) {
                calls.push(options);
                return [];
            },
        };
        const { service } = createService({
            provider,
            clock: () => Date.parse(date),
        });

        await assertGenerationError(
            service,
            'Historical candle data is incomplete.',
        );
        assert.equal(calls[0].fromDate, expectedFromDate);
    });
}

test('allows a requested range starting on the configured earliest date', async () => {
    const calls = [];
    const provider = {
        async getHistoricalCandles(options) {
            calls.push(options);
            return [];
        },
    };
    const { service } = createService({
        provider,
        clock: () => Date.parse('2022-02-01T12:00:00+05:30'),
    });

    await assertGenerationError(service, 'Historical candle data is incomplete.');
    assert.equal(calls[0].fromDate, '2022-01-01');
});

test('rejects a requested range before the configured earliest date without fetching', async () => {
    const provider = createProvider();
    const { service } = createService({
        provider,
        clock: () => Date.parse('2022-01-31T12:00:00+05:30'),
    });

    await assertGenerationError(
        service,
        'The requested historical range is unavailable.',
    );
    assert.equal(provider.calls.length, 0);
});

test('does not persist a NO_SIGNAL result', async () => {
    const candles = createCandles();
    candles.at(-1).volume = 1000;
    let insertCalled = false;
    const { service } = createService({
        candles,
        store: {
            insert() {
                insertCalled = true;
            },
        },
    });

    const result = await service.generateAndPersist();

    assert.equal(result.status, 'NO_SIGNAL');
    assert.equal(insertCalled, false);
});

test('rejects insufficient historical data without persisting', async () => {
    let insertCalled = false;
    const { service } = createService({
        candles: createCandles().slice(1),
        store: {
            insert() {
                insertCalled = true;
            },
        },
    });

    await assertGenerationError(
        service,
        'Historical candle data is incomplete.',
    );
    assert.equal(insertCalled, false);
});

for (const [name, mutate] of [
    ['invalid OHLCV', candles => {
        candles.at(-1).high = 100;
    }],
    ['out-of-order', candles => {
        [candles[10], candles[11]] = [candles[11], candles[10]];
    }],
]) {
    test(`rejects ${name} data before persisting`, async () => {
        const candles = createCandles();
        mutate(candles);
        let insertCalled = false;
        const { service } = createService({
            candles,
            store: {
                insert() {
                    insertCalled = true;
                },
            },
        });

        await assertGenerationError(
            service,
            'Historical candle data is invalid.',
        );
        assert.equal(insertCalled, false);
    });
}

test('rejects stale candles without persisting', async () => {
    let insertCalled = false;
    const { service } = createService({
        clock: () => EVALUATION_TIME + 10 * 60_000,
        store: {
            insert() {
                insertCalled = true;
            },
        },
    });

    await assertGenerationError(
        service,
        'Candle eligibility or strategy validation failed.',
    );
    assert.equal(insertCalled, false);
});

test('fails closed when candle finality cannot be established', async () => {
    let insertCalled = false;
    const { service } = createService({
        finality: { areFinalized: async () => false },
        store: {
            insert() {
                insertCalled = true;
            },
        },
    });

    await assertGenerationError(
        service,
        'Candle finality could not be established.',
    );
    assert.equal(insertCalled, false);
});

test('requires explicit calendar and candle-finality policies', () => {
    for (const policies of [
        { calendarPolicy },
        { candleFinalityPolicy },
    ]) {
        assert.throws(
            () =>
                createPaperProposalGenerationService({
                    historicalCandleProvider: createProvider(),
                    proposalStore: createStore(),
                    clock: () => EVALUATION_TIME,
                    ...policies,
                }),
            error => {
                assert.ok(error instanceof PaperProposalGenerationError);
                assert.equal(
                    error.message,
                    'Generation dependencies are incomplete.',
                );
                return true;
            },
        );
    }
});

test('requires an explicitly injected historical candle provider', () => {
    assert.throws(
        () => createPaperProposalGenerationService({
            proposalStore: createStore(),
            clock: () => EVALUATION_TIME,
            calendarPolicy,
            candleFinalityPolicy,
        }),
        error => {
            assert.ok(error instanceof PaperProposalGenerationError);
            assert.equal(error.message, 'Generation dependencies are incomplete.');
            return true;
        },
    );
});

test('rejects invalid calendar policy output without persisting', async () => {
    let insertCalled = false;
    const { service } = createService({
        calendar: { getCandleEndTime: () => 0 },
        store: {
            insert() {
                insertCalled = true;
            },
        },
    });

    await assertGenerationError(
        service,
        'Candle eligibility or strategy validation failed.',
    );
    assert.equal(insertCalled, false);
});

test('sanitizes historical provider failures', async () => {
    const provider = {
        async getHistoricalCandles() {
            throw new Error('credential-value-must-not-leak');
        },
    };
    const { service } = createService({ provider });

    await assert.rejects(
        service.generateAndPersist(),
        error => {
            assert.equal(
                error.message,
                'Historical candle retrieval failed.',
            );
            assert.equal(error.message.includes('credential-value'), false);
            assert.equal(error.cause, undefined);
            return true;
        },
    );
});

test('does not report success when persistence fails', async () => {
    const { service } = createService({
        store: {
            insert() {
                throw new Error('database-detail-must-not-leak');
            },
        },
    });

    await assert.rejects(
        service.generateAndPersist(),
        error => {
            assert.equal(
                error.message,
                'Paper-proposal persistence failed.',
            );
            assert.equal(error.message.includes('database-detail'), false);
            assert.equal(error.cause, undefined);
            return true;
        },
    );
});

for (const [name, result] of [
    ['missing', undefined],
    ['invalid created flag', { created: 'yes', proposal: {} }],
    ['wrong proposal status', {
        created: true,
        proposal: { ...createStore().insert({
            strategyId: 'nifty50-intraday-trend',
            strategyVersion: 1,
            instrument: 'NIFTY50',
            side: 'BUY',
            signalTimestamp: 1,
            evaluatedAt: 1,
        }), payload: { status: 'NO_SIGNAL' } },
    }],
]) {
    test(`rejects ${name} persistence result`, async () => {
        const { service } = createService({ store: { insert: () => result } });
        await assertGenerationError(
            service,
            'Paper-proposal persistence failed.',
        );
    });
}

test('rejects an insertion result for a different proposal identity', async () => {
    const store = createStore();
    const { service } = createService({
        store: {
            insert(proposal) {
                const insertion = store.insert(proposal);
                return {
                    ...insertion,
                    proposal: {
                        ...insertion.proposal,
                        strategyId: 'different-strategy',
                    },
                };
            },
        },
    });

    await assertGenerationError(
        service,
        'Paper-proposal persistence failed.',
    );
});

test('repeated runs preserve the original persisted proposal', async t => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-generation-test-'),
    );
    const store = createPaperProposalStore({
        databasePath: path.join(
            temporaryDirectory,
            'paper-proposals.sqlite',
        ),
        now: () => EVALUATION_TIME,
    });
    t.after(() => {
        try {
            store.close();
        } finally {
            rmSync(temporaryDirectory, { recursive: true, force: true });
        }
    });

    let evaluationTime = EVALUATION_TIME;
    const { service } = createService({
        store,
        clock: () => evaluationTime,
    });
    const first = await service.generateAndPersist();
    evaluationTime += 1_000;
    const repeated = await service.generateAndPersist();

    assert.equal(first.status, 'PERSISTED');
    assert.equal(first.created, true);
    assert.equal(repeated.status, 'PERSISTED');
    assert.equal(repeated.created, false);
    assert.deepEqual(repeated.proposal, first.proposal);
    assert.equal(store.list().proposals.length, 1);
});
