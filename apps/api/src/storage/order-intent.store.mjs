import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import {
    validateOrderIntentDatabasePath,
} from '../config/order-intent.config.mjs';

const DEFAULT_STALE_AFTER_MS = 60_000;

export class OrderIntentStoreError extends Error {
    constructor() {
        super('Order-intent persistence is unavailable.');
        this.statusCode = 503;
    }
}

export class IdempotencyConflictError extends Error {
    constructor() {
        super('The idempotency key was already used for a different order.');
        this.statusCode = 409;
    }
}

function serialize(value) {
    const serialized = JSON.stringify(value);

    if (typeof serialized !== 'string') {
        throw new OrderIntentStoreError();
    }

    return serialized;
}

function deserialize(row) {
    try {
        return {
            keyHash: row.key_hash,
            fingerprint: row.order_fingerprint,
            state: row.state,
            order: JSON.parse(row.order_json),
            result: row.result_json === null
                ? null
                : JSON.parse(row.result_json),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    } catch {
        throw new OrderIntentStoreError();
    }
}

export class OrderIntentStore {
    constructor({
        databasePath,
        staleAfterMs = DEFAULT_STALE_AFTER_MS,
        now = Date.now,
    }) {
        if (
            !Number.isSafeInteger(staleAfterMs) ||
            staleAfterMs < 0 ||
            typeof now !== 'function'
        ) {
            throw new OrderIntentStoreError();
        }

        const resolvedPath = validateOrderIntentDatabasePath(databasePath);
        let database;

        try {
            mkdirSync(path.dirname(resolvedPath), { recursive: true });
            database = new Database(resolvedPath);
            database.pragma('journal_mode = WAL');
            database.pragma('synchronous = FULL');
            database.pragma('busy_timeout = 5000');
            database.exec(`
                CREATE TABLE IF NOT EXISTS order_intents (
                    key_hash TEXT PRIMARY KEY,
                    order_fingerprint TEXT NOT NULL,
                    state TEXT NOT NULL CHECK (
                        state IN ('SUBMITTING', 'SUBMITTED', 'REJECTED', 'UNKNOWN')
                    ),
                    order_json TEXT NOT NULL,
                    result_json TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            `);
        } catch {
            database?.close();
            throw new OrderIntentStoreError();
        }

        this.database = database;
        this.databasePath = resolvedPath;
        this.staleAfterMs = staleAfterMs;
        this.now = now;
        this.selectIntent = database.prepare(
            'SELECT * FROM order_intents WHERE key_hash = ?',
        );
        this.insertIntent = database.prepare(`
            INSERT INTO order_intents (
                key_hash,
                order_fingerprint,
                state,
                order_json,
                result_json,
                created_at,
                updated_at
            ) VALUES (?, ?, 'SUBMITTING', ?, NULL, ?, ?)
        `);
        this.updateIntent = database.prepare(`
            UPDATE order_intents
            SET state = ?, result_json = ?, updated_at = ?
            WHERE key_hash = ? AND state = 'SUBMITTING'
        `);
        this.recoverStale = database.prepare(`
            UPDATE order_intents
            SET state = 'UNKNOWN', updated_at = ?
            WHERE state = 'SUBMITTING' AND updated_at <= ?
        `);
        this.claimTransaction = database.transaction(
            (keyHash, fingerprint, orderJson) => {
                this.recoverStale.run(
                    this.now(),
                    this.now() - this.staleAfterMs,
                );

                const existing = this.selectIntent.get(keyHash);
                if (existing) {
                    if (existing.order_fingerprint !== fingerprint) {
                        throw new IdempotencyConflictError();
                    }

                    return {
                        created: false,
                        intent: deserialize(existing),
                    };
                }

                const now = this.now();
                this.insertIntent.run(
                    keyHash,
                    fingerprint,
                    orderJson,
                    now,
                    now,
                );

                return {
                    created: true,
                    intent: deserialize(this.selectIntent.get(keyHash)),
                };
            },
        ).immediate;

        try {
            this.recoverStaleSubmissions();
        } catch {
            this.close();
            throw new OrderIntentStoreError();
        }
    }

    claim(keyHash, fingerprint, order) {
        try {
            return this.claimTransaction(
                keyHash,
                fingerprint,
                serialize(order),
            );
        } catch (error) {
            if (error instanceof IdempotencyConflictError) {
                throw error;
            }

            if (error instanceof OrderIntentStoreError) {
                throw error;
            }

            throw new OrderIntentStoreError();
        }
    }

    markSubmitted(keyHash, result) {
        this.transition(keyHash, 'SUBMITTED', result);
    }

    markRejected(keyHash) {
        this.transition(keyHash, 'REJECTED', {
            message: 'Sandbox provider confirmed order rejection.',
        });
    }

    markUnknown(keyHash) {
        this.transition(keyHash, 'UNKNOWN', null);
    }

    recoverStaleSubmissions() {
        try {
            const now = this.now();
            this.recoverStale.run(now, now - this.staleAfterMs);
        } catch {
            throw new OrderIntentStoreError();
        }
    }

    close() {
        try {
            if (this.database.open) {
                this.database.close();
            }
        } catch {
            throw new OrderIntentStoreError();
        }
    }

    transition(keyHash, state, result) {
        try {
            const serialized = result === null ? null : serialize(result);
            const update = this.updateIntent.run(
                state,
                serialized,
                this.now(),
                keyHash,
            );

            if (update.changes !== 1) {
                throw new OrderIntentStoreError();
            }
        } catch (error) {
            if (error instanceof OrderIntentStoreError) {
                throw error;
            }

            throw new OrderIntentStoreError();
        }
    }
}

export function createOrderIntentStore(options) {
    return new OrderIntentStore(options);
}
