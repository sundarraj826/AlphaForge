import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createApiServer } from '../server.mjs';
import {
    NIFTY50_PAPER_STRATEGY_CONFIG,
} from '../config/nifty50-paper-strategy.config.mjs';
import { generatePaperProposal } from '../services/paper-proposal.service.mjs';
import { createPaperProposalStore } from '../storage/paper-proposal.store.mjs';

const LOCAL_API_TOKEN = 'paper-proposal-test-token-123456789';
const CANDLE_DURATION_MS = 15 * 60_000;
const START_TIME = Date.parse('2026-10-27T09:15:00+05:30');
const CREATED_AT = Date.parse('2026-10-27T13:00:00+05:30');
const calendarPolicy = {
    getCandleEndTime: ({ candleStartTime, nominalDurationMs }) =>
        candleStartTime + nominalDurationMs,
};

function createValidProposal() {
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
    const latestCandle = candles.at(-1);
    const evaluationTime =
        latestCandle.timestamp +
        CANDLE_DURATION_MS +
        NIFTY50_PAPER_STRATEGY_CONFIG.evaluation.finalizationDelayMs;

    return generatePaperProposal({
        candles,
        clock: () => evaluationTime,
        calendarPolicy,
        configuration: NIFTY50_PAPER_STRATEGY_CONFIG,
    });
}

async function startServer(t, paperProposalStore) {
    const server = createApiServer({
        localApiToken: LOCAL_API_TOKEN,
        orderIntentStore: {},
        paperProposalStore,
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise(resolve => {
        server.close(resolve);
    }));

    return `http://127.0.0.1:${server.address().port}`;
}

test('GET /api/paper-proposals requires the local Bearer token', async t => {
    let listCalled = false;
    const baseUrl = await startServer(t, {
        list: () => {
            listCalled = true;
            return { proposals: [], nextCursor: null };
        },
    });

    const response = await fetch(`${baseUrl}/api/paper-proposals`);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
        status: 'error',
        message: 'Valid local API credentials are required.',
    });
    const invalidTokenResponse = await fetch(
        `${baseUrl}/api/paper-proposals`,
        { headers: { Authorization: 'Bearer invalid' } },
    );
    assert.equal(invalidTokenResponse.status, 401);
    assert.equal(listCalled, false);
});

test('GET /api/paper-proposals returns a bounded page with no database path', async t => {
    let receivedOptions;
    const proposal = {
        proposalId: 'a'.repeat(64),
        strategyId: 'nifty50-intraday-trend',
        strategyVersion: 1,
        instrument: 'NIFTY50',
        signal: 'BUY',
        candleTimestamp: 1_798_000_000_000,
        createdAt: 1_798_000_900_000,
        payload: { status: 'PAPER_PROPOSAL' },
    };
    const baseUrl = await startServer(t, {
        list: options => {
            receivedOptions = options;
            return { proposals: [proposal], nextCursor: 'opaque-cursor' };
        },
    });

    const response = await fetch(
        `${baseUrl}/api/paper-proposals?limit=5&cursor=opaque-cursor`,
        { headers: { Authorization: `Bearer ${LOCAL_API_TOKEN}` } },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(receivedOptions, {
        limit: 5,
        cursor: 'opaque-cursor',
    });
    assert.deepEqual(body, {
        status: 'success',
        data: {
            proposals: [proposal],
            nextCursor: 'opaque-cursor',
        },
    });
    assert.equal(JSON.stringify(body).includes('databasePath'), false);
});

test('GET /api/paper-proposals rejects invalid page size generically', async t => {
    let listCalled = false;
    const baseUrl = await startServer(t, {
        list: () => {
            listCalled = true;
            return { proposals: [], nextCursor: null };
        },
    });

    const response = await fetch(
        `${baseUrl}/api/paper-proposals?limit=101`,
        { headers: { Authorization: `Bearer ${LOCAL_API_TOKEN}` } },
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
        status: 'error',
        message: 'Invalid paper-proposal pagination query.',
    });
    assert.equal(listCalled, false);
});

test('GET /api/paper-proposals hides storage errors and database paths', async t => {
    const baseUrl = await startServer(t, {
        list() {
            throw new Error('Failure at D:\\private\\paper-proposals.sqlite');
        },
    });

    const response = await fetch(
        `${baseUrl}/api/paper-proposals`,
        { headers: { Authorization: `Bearer ${LOCAL_API_TOKEN}` } },
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
        status: 'error',
        message: 'Paper-proposal storage is unavailable.',
    });
});

test('generates, persists across store restart, and retrieves an authenticated paper proposal', async t => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-proposal-lifecycle-'),
    );
    const databasePath = path.join(
        temporaryDirectory,
        'paper-proposals.sqlite',
    );
    let store;
    let server;

    t.after(async () => {
        if (server?.listening) {
            await new Promise(resolve => server.close(resolve));
        }
        if (store?.database.open) {
            store.close();
        }
        rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    store = createPaperProposalStore({
        databasePath,
        now: () => CREATED_AT,
    });
    const generatedProposal = createValidProposal();
    assert.equal(generatedProposal.status, 'PAPER_PROPOSAL');
    assert.equal(generatedProposal.side, 'BUY');
    assert.equal(generatedProposal.instrument, 'NIFTY50');

    const insertion = store.insert(generatedProposal);
    assert.equal(insertion.created, true);
    store.close();

    store = createPaperProposalStore({
        databasePath,
        now: () => CREATED_AT + 1,
    });
    server = createApiServer({
        localApiToken: LOCAL_API_TOKEN,
        orderIntentStore: {},
        paperProposalStore: store,
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const unauthenticatedResponse = await fetch(
        `${baseUrl}/api/paper-proposals?limit=5`,
    );
    const unauthenticatedBody = await unauthenticatedResponse.text();
    assert.equal(unauthenticatedResponse.status, 401);
    assert.equal(unauthenticatedBody.includes(insertion.proposal.proposalId), false);
    assert.equal(unauthenticatedBody.includes('PAPER_PROPOSAL'), false);

    const response = await fetch(
        `${baseUrl}/api/paper-proposals?limit=5`,
        { headers: { Authorization: `Bearer ${LOCAL_API_TOKEN}` } },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body, {
        status: 'success',
        data: {
            proposals: [insertion.proposal],
            nextCursor: null,
        },
    });
    assert.deepEqual(body.data.proposals[0].payload, generatedProposal);
});
