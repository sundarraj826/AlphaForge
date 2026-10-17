
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxOnly } from './upstox.config.mjs';

const SANDBOX_URL = 'https://api-sandbox.upstox.com';

test('accepts a correctly configured Sandbox client', () => {
    assert.doesNotThrow(() =>
        assertSandboxOnly({
            sandbox: true,
            basePath: SANDBOX_URL,
            orderBasePath: SANDBOX_URL,
        }),
    );
});

test('rejects a client that is not in Sandbox mode', () => {
    assert.throws(
        () =>
            assertSandboxOnly({
                sandbox: false,
                basePath: SANDBOX_URL,
                orderBasePath: SANDBOX_URL,
            }),
        /requires Upstox Sandbox mode/,
    );
});

test('rejects an unexpected API hostname', () => {
    assert.throws(
        () =>
            assertSandboxOnly({
                sandbox: true,
                basePath: 'https://api.upstox.com',
                orderBasePath: SANDBOX_URL,
            }),
        /Unexpected Upstox API host/,
    );
});
