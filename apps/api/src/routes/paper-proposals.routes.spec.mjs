import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from '../server.mjs';

const LOCAL_API_TOKEN = 'paper-proposal-test-token-123456789';

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
