import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import {
    createPaperProposalStore,
    PaperProposalStoreError,
} from './paper-proposal.store.mjs';

const PROPOSAL = {
    status: 'PAPER_PROPOSAL',
    strategyId: 'nifty50-intraday-trend',
    strategyVersion: 1,
    instrument: 'NIFTY50',
    timeframe: '15m',
    side: 'BUY',
    signalTimestamp: 1_798_000_000_000,
    evaluatedAt: 1_798_000_900_000,
    referencePrice: 150,
    execution: {
        status: 'UNAVAILABLE',
        orderableInstrumentToken: null,
        quantity: null,
        limitPrice: null,
        riskCheck: 'NOT_EVALUATED',
        reason: 'Execution is unavailable.',
    },
};

function createTemporaryDirectory() {
    return mkdtempSync(path.join(tmpdir(), 'alphaforge-proposal-test-'));
}

function databasePathFor(directory) {
    return path.join(directory, 'paper-proposals.sqlite');
}

test('persists validated proposal data across separate store connections', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const databasePath = databasePathFor(temporaryDirectory);
    const firstStore = createPaperProposalStore({
        databasePath,
        now: () => 1_798_000_901_000,
    });

    try {
        const inserted = firstStore.insert(PROPOSAL);
        assert.equal(inserted.created, true);
        firstStore.close();

        const secondStore = createPaperProposalStore({ databasePath });
        try {
            const duplicate = secondStore.insert(PROPOSAL);
            assert.equal(duplicate.created, false);
            assert.deepEqual(duplicate.proposal, {
                proposalId: inserted.proposal.proposalId,
                strategyId: PROPOSAL.strategyId,
                strategyVersion: PROPOSAL.strategyVersion,
                instrument: PROPOSAL.instrument,
                signal: PROPOSAL.side,
                candleTimestamp: PROPOSAL.signalTimestamp,
                createdAt: 1_798_000_901_000,
                payload: PROPOSAL,
            });
        } finally {
            secondStore.close();
        }
    } finally {
        if (firstStore.database.open) {
            firstStore.close();
        }
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('prevents duplicate proposal identities without replacing the first payload', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const databasePath = databasePathFor(temporaryDirectory);
    const store = createPaperProposalStore({
        databasePath,
        now: () => 1_798_000_901_000,
    });

    try {
        const first = store.insert(PROPOSAL);
        const changedRepeat = store.insert({
            ...PROPOSAL,
            evaluatedAt: PROPOSAL.evaluatedAt + 1_000,
            referencePrice: 151,
        });

        assert.equal(first.created, true);
        assert.equal(changedRepeat.created, false);
        assert.deepEqual(changedRepeat.proposal.payload, PROPOSAL);

        const database = new Database(databasePath, { readonly: true });
        try {
            assert.equal(
                database
                    .prepare('SELECT COUNT(*) AS count FROM paper_proposals')
                    .get().count,
                1,
            );
        } finally {
            database.close();
        }
    } finally {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('allows only one concurrent insert across independent store connections', async () => {
    const temporaryDirectory = createTemporaryDirectory();
    const databasePath = databasePathFor(temporaryDirectory);
    const firstStore = createPaperProposalStore({ databasePath });
    const secondStore = createPaperProposalStore({ databasePath });

    try {
        const results = await Promise.all([
            Promise.resolve().then(() => firstStore.insert(PROPOSAL)),
            Promise.resolve().then(() => secondStore.insert(PROPOSAL)),
        ]);

        assert.equal(results.filter(result => result.created).length, 1);
        assert.equal(results.filter(result => !result.created).length, 1);
        assert.equal(
            results[0].proposal.proposalId,
            results[1].proposal.proposalId,
        );

        const database = new Database(databasePath, { readonly: true });
        try {
            assert.equal(
                database
                    .prepare('SELECT COUNT(*) AS count FROM paper_proposals')
                    .get().count,
                1,
            );
        } finally {
            database.close();
        }
    } finally {
        firstStore.close();
        secondStore.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('rejects invalid proposal input', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const store = createPaperProposalStore({
        databasePath: databasePathFor(temporaryDirectory),
    });
    const invalidProposals = [
        null,
        { ...PROPOSAL, status: 'NO_SIGNAL' },
        { ...PROPOSAL, strategyVersion: 0 },
        { ...PROPOSAL, side: 'WAIT' },
        { ...PROPOSAL, signalTimestamp: Number.NaN },
        { ...PROPOSAL, signalTimestamp: -1 },
        { ...PROPOSAL, evaluatedAt: Number.POSITIVE_INFINITY },
        { ...PROPOSAL, evaluatedAt: 1.5 },
        { ...PROPOSAL, referencePrice: Infinity },
        { ...PROPOSAL, diagnostics: { score: Number.NaN } },
        { ...PROPOSAL, metadata: { limits: [1, Number.NEGATIVE_INFINITY] } },
        { ...PROPOSAL, metadata: { offset: -0 } },
        { ...PROPOSAL, diagnostics: { value: undefined } },
        { ...PROPOSAL, diagnostics: { callback: () => true } },
        { ...PROPOSAL, diagnostics: { value: 1n } },
        { ...PROPOSAL, diagnostics: { value: Symbol('unsupported') } },
        { ...PROPOSAL, diagnostics: { value: new Date(0) } },
        {
            ...PROPOSAL,
            execution: { ...PROPOSAL.execution, quantity: 1 },
        },
    ];
    const sparseValues = [];
    sparseValues[1] = 'value';
    invalidProposals.push({
        ...PROPOSAL,
        diagnostics: { values: sparseValues },
    });
    const cyclicProposal = { ...PROPOSAL };
    cyclicProposal.metadata = { parent: cyclicProposal };
    invalidProposals.push(cyclicProposal);
    const accessorProposal = { ...PROPOSAL };
    Object.defineProperty(accessorProposal, 'diagnostics', {
        enumerable: true,
        get: () => ({ value: 'must not be evaluated' }),
    });
    invalidProposals.push(accessorProposal);

    try {
        for (const proposal of invalidProposals) {
            assert.throws(
                () => store.insert(proposal),
                PaperProposalStoreError,
            );
        }

        const database = new Database(
            databasePathFor(temporaryDirectory),
            { readonly: true },
        );
        try {
            assert.equal(
                database
                    .prepare('SELECT COUNT(*) AS count FROM paper_proposals')
                    .get().count,
                0,
            );
        } finally {
            database.close();
        }
    } finally {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('rejects non-canonical whitespace variants in identity fields', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const store = createPaperProposalStore({
        databasePath: databasePathFor(temporaryDirectory),
    });
    const invalidProposals = [
        { ...PROPOSAL, strategyId: ` ${PROPOSAL.strategyId}` },
        { ...PROPOSAL, strategyId: `${PROPOSAL.strategyId} ` },
        { ...PROPOSAL, instrument: ` ${PROPOSAL.instrument}` },
        { ...PROPOSAL, instrument: `${PROPOSAL.instrument}\t` },
    ];

    try {
        for (const proposal of invalidProposals) {
            assert.throws(
                () => store.insert(proposal),
                PaperProposalStoreError,
            );
        }
    } finally {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('persists additional JSON-safe proposal fields without restricting them', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const store = createPaperProposalStore({
        databasePath: databasePathFor(temporaryDirectory),
    });
    const proposal = {
        ...PROPOSAL,
        metadata: {
            source: 'mock',
            annotations: ['reviewed', null],
        },
    };

    try {
        const inserted = store.insert(proposal);
        assert.equal(inserted.created, true);
        assert.deepEqual(inserted.proposal.payload, proposal);
    } finally {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});
