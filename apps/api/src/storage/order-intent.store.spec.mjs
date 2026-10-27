import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

import {
    createOrderIntentStore,
    IdempotencyConflictError,
    OrderIntentStoreError,
} from './order-intent.store.mjs';

const ORDER = {
    instrumentToken: 'NSE_EQ|TEST',
    quantity: 2,
    price: 10,
    product: 'I',
    validity: 'DAY',
    orderType: 'LIMIT',
    transactionType: 'BUY',
};
const KEY = 'store-test-idempotency-key';
const KEY_HASH = createHash('sha256').update(KEY).digest('hex');
const FINGERPRINT = createHash('sha256')
    .update(JSON.stringify(ORDER))
    .digest('hex');

function createTemporaryDirectory() {
    return mkdtempSync(path.join(tmpdir(), 'alphaforge-intent-test-'));
}

test('stores only hashed keys and persists transitions and successful results', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    const store = createOrderIntentStore({ databasePath });

    try {
        const claimed = store.claim(KEY_HASH, FINGERPRINT, ORDER);
        assert.equal(claimed.created, true);
        assert.equal(claimed.intent.state, 'SUBMITTING');
        store.markSubmitted(KEY_HASH, {
            status: 'success',
            orderIds: ['sandbox-mock-id'],
        });

        const database = new Database(databasePath, { readonly: true });
        try {
            const row = database.prepare(
                'SELECT key_hash, state, result_json FROM order_intents',
            ).get();
            assert.equal(row.key_hash, KEY_HASH);
            assert.equal(row.key_hash.includes(KEY), false);
            assert.equal(row.state, 'SUBMITTED');
            assert.deepEqual(JSON.parse(row.result_json), {
                status: 'success',
                orderIds: ['sandbox-mock-id'],
            });
        } finally {
            database.close();
        }

        const replay = store.claim(KEY_HASH, FINGERPRINT, ORDER);
        assert.equal(replay.created, false);
        assert.equal(replay.intent.state, 'SUBMITTED');
        assert.deepEqual(replay.intent.result.orderIds, ['sandbox-mock-id']);
    } finally {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('rejects a key already claimed for a different order fingerprint', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const store = createOrderIntentStore({
        databasePath: path.join(
            temporaryDirectory,
            'order-intents.sqlite',
        ),
    });

    try {
        store.claim(KEY_HASH, FINGERPRINT, ORDER);
        assert.throws(
            () =>
                store.claim(
                    KEY_HASH,
                    'c'.repeat(64),
                    { ...ORDER, quantity: 3 },
                ),
            IdempotencyConflictError,
        );
    } finally {
        store.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('allows only one concurrent claim across independent store connections', async () => {
    const temporaryDirectory = createTemporaryDirectory();
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    const firstStore = createOrderIntentStore({ databasePath });
    const secondStore = createOrderIntentStore({ databasePath });

    try {
        const claims = await Promise.all([
            Promise.resolve().then(() =>
                firstStore.claim(KEY_HASH, FINGERPRINT, ORDER),
            ),
            Promise.resolve().then(() =>
                secondStore.claim(KEY_HASH, FINGERPRINT, ORDER),
            ),
        ]);

        assert.equal(
            claims.filter(claim => claim.created).length,
            1,
        );
        assert.equal(
            claims.filter(
                claim =>
                    !claim.created &&
                    claim.intent.state === 'SUBMITTING',
            ).length,
            1,
        );
        const database = new Database(databasePath, { readonly: true });
        try {
            assert.equal(
                database
                    .prepare('SELECT COUNT(*) AS count FROM order_intents')
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

test('transitions only stale SUBMITTING records to UNKNOWN after reopening', () => {
    const temporaryDirectory = createTemporaryDirectory();
    const databasePath = path.join(
        temporaryDirectory,
        'order-intents.sqlite',
    );
    let now = 1_000_000;
    const firstStore = createOrderIntentStore({
        databasePath,
        staleAfterMs: 1_000,
        now: () => now,
    });
    firstStore.claim(KEY_HASH, FINGERPRINT, ORDER);
    firstStore.close();

    now += 1_001;
    const reopenedStore = createOrderIntentStore({
        databasePath,
        staleAfterMs: 1_000,
        now: () => now,
    });

    try {
        const recovered = reopenedStore.claim(KEY_HASH, FINGERPRINT, ORDER);
        assert.equal(recovered.created, false);
        assert.equal(recovered.intent.state, 'UNKNOWN');
    } finally {
        reopenedStore.close();
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('fails closed when the database cannot be initialized or written', () => {
    const temporaryDirectory = createTemporaryDirectory();

    assert.throws(
        () => createOrderIntentStore({ databasePath: temporaryDirectory }),
        OrderIntentStoreError,
    );

    const store = createOrderIntentStore({
        databasePath: path.join(
            temporaryDirectory,
            'order-intents.sqlite',
        ),
    });
    store.close();
    assert.throws(
        () => store.claim(KEY_HASH, FINGERPRINT, ORDER),
        OrderIntentStoreError,
    );
    rmSync(temporaryDirectory, { recursive: true, force: true });
});
