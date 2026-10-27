import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
    loadOrderIntentDatabasePath,
    OrderIntentConfigurationError,
    validateOrderIntentDatabasePath,
} from './order-intent.config.mjs';

test('loads an absolute order-intent database path outside the repository', () => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-intent-config-'),
    );
    try {
        const databasePath = path.join(
            temporaryDirectory,
            'order-intents.sqlite',
        );
        assert.equal(
            loadOrderIntentDatabasePath({
                ALPHAFORGE_ORDER_INTENTS_DB_PATH: databasePath,
            }),
            databasePath,
        );
    } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('rejects missing, relative, and repository-local database paths', () => {
    assert.throws(
        () => loadOrderIntentDatabasePath({}),
        OrderIntentConfigurationError,
    );
    assert.throws(
        () => validateOrderIntentDatabasePath('data/order-intents.sqlite'),
        OrderIntentConfigurationError,
    );
    assert.throws(
        () => validateOrderIntentDatabasePath(process.cwd()),
        OrderIntentConfigurationError,
    );
});
