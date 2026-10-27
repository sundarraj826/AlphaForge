import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import {
    validatePaperProposalDatabasePath,
} from '../config/paper-proposal.config.mjs';

export class PaperProposalStoreError extends Error {
    constructor() {
        super('Paper-proposal persistence is unavailable.');
        this.statusCode = 503;
    }
}

function invalidProposal() {
    throw new PaperProposalStoreError();
}

function isCanonicalIdentityString(value) {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value === value.trim() &&
        value.normalize('NFC') === value
    );
}

function cloneJsonValue(value, ancestors = new WeakSet()) {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean'
    ) {
        return value;
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value) || Object.is(value, -0)) {
            invalidProposal();
        }
        return value;
    }

    if (typeof value !== 'object') {
        invalidProposal();
    }

    if (ancestors.has(value)) {
        invalidProposal();
    }
    ancestors.add(value);

    try {
        if (Array.isArray(value)) {
            const ownKeys = Reflect.ownKeys(value);
            if (
                ownKeys.length !== value.length + 1 ||
                !ownKeys.includes('length')
            ) {
                invalidProposal();
            }

            const clone = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(
                    value,
                    String(index),
                );
                if (
                    !descriptor ||
                    !descriptor.enumerable ||
                    !Object.hasOwn(descriptor, 'value')
                ) {
                    invalidProposal();
                }
                clone.push(cloneJsonValue(descriptor.value, ancestors));
            }
            return clone;
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            invalidProposal();
        }

        const clone = Object.create(null);
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string') {
                invalidProposal();
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (
                !descriptor ||
                !descriptor.enumerable ||
                !Object.hasOwn(descriptor, 'value')
            ) {
                invalidProposal();
            }
            Object.defineProperty(clone, key, {
                value: cloneJsonValue(descriptor.value, ancestors),
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }
        return clone;
    } finally {
        ancestors.delete(value);
    }
}

function validateProposal(input) {
    let proposal;
    try {
        proposal = cloneJsonValue(input);
    } catch {
        invalidProposal();
    }

    if (
        !proposal ||
        typeof proposal !== 'object' ||
        proposal.status !== 'PAPER_PROPOSAL' ||
        !isCanonicalIdentityString(proposal.strategyId) ||
        !Number.isSafeInteger(proposal.strategyVersion) ||
        proposal.strategyVersion <= 0 ||
        !isCanonicalIdentityString(proposal.instrument) ||
        !['BUY', 'SELL'].includes(proposal.side) ||
        !Number.isSafeInteger(proposal.signalTimestamp) ||
        proposal.signalTimestamp < 0 ||
        !Number.isSafeInteger(proposal.evaluatedAt) ||
        proposal.evaluatedAt < 0 ||
        !Number.isFinite(proposal.referencePrice) ||
        proposal.referencePrice <= 0 ||
        !proposal.execution ||
        proposal.execution.status !== 'UNAVAILABLE' ||
        proposal.execution.orderableInstrumentToken !== null ||
        proposal.execution.quantity !== null ||
        proposal.execution.limitPrice !== null ||
        proposal.execution.riskCheck !== 'NOT_EVALUATED' ||
        typeof proposal.execution.reason !== 'string' ||
        !proposal.execution.reason.trim()
    ) {
        throw new PaperProposalStoreError();
    }

    const payload = JSON.stringify(proposal);
    if (typeof payload !== 'string') {
        throw new PaperProposalStoreError();
    }

    return {
        strategyId: proposal.strategyId,
        strategyVersion: proposal.strategyVersion,
        instrument: proposal.instrument,
        signal: proposal.side,
        candleTimestamp: proposal.signalTimestamp,
        payload,
    };
}

function createProposalId(identity) {
    return createHash('sha256')
        .update(JSON.stringify([
            identity.strategyId,
            identity.strategyVersion,
            identity.instrument,
            identity.signal,
            identity.candleTimestamp,
        ]))
        .digest('hex');
}

function deserializeProposal(row) {
    try {
        return {
            proposalId: row.proposal_id,
            strategyId: row.strategy_id,
            strategyVersion: row.strategy_version,
            instrument: row.instrument,
            signal: row.signal,
            candleTimestamp: row.candle_timestamp,
            createdAt: row.created_at,
            payload: JSON.parse(row.payload_json),
        };
    } catch {
        throw new PaperProposalStoreError();
    }
}

export class PaperProposalStore {
    constructor({ databasePath, now = Date.now }) {
        if (typeof now !== 'function') {
            throw new PaperProposalStoreError();
        }

        const resolvedPath =
            validatePaperProposalDatabasePath(databasePath);
        let database;

        try {
            mkdirSync(path.dirname(resolvedPath), { recursive: true });
            database = new Database(resolvedPath);
            database.pragma('journal_mode = WAL');
            database.pragma('synchronous = FULL');
            database.pragma('busy_timeout = 5000');
            database.exec(`
                CREATE TABLE IF NOT EXISTS paper_proposals (
                    proposal_id TEXT PRIMARY KEY,
                    strategy_id TEXT NOT NULL,
                    strategy_version INTEGER NOT NULL CHECK (strategy_version > 0),
                    instrument TEXT NOT NULL,
                    signal TEXT NOT NULL CHECK (signal IN ('BUY', 'SELL')),
                    candle_timestamp INTEGER NOT NULL,
                    created_at INTEGER NOT NULL,
                    payload_json TEXT NOT NULL,
                    UNIQUE (
                        strategy_id,
                        strategy_version,
                        instrument,
                        signal,
                        candle_timestamp
                    )
                )
            `);
        } catch {
            database?.close();
            throw new PaperProposalStoreError();
        }

        this.database = database;
        this.now = now;
        this.insertProposal = database.prepare(`
            INSERT INTO paper_proposals (
                proposal_id,
                strategy_id,
                strategy_version,
                instrument,
                signal,
                candle_timestamp,
                created_at,
                payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (
                strategy_id,
                strategy_version,
                instrument,
                signal,
                candle_timestamp
            ) DO NOTHING
        `);
        this.selectProposal = database.prepare(`
            SELECT * FROM paper_proposals
            WHERE strategy_id = ?
                AND strategy_version = ?
                AND instrument = ?
                AND signal = ?
                AND candle_timestamp = ?
        `);
        this.insertTransaction = database.transaction(identity => {
            const createdAt = this.now();
            if (!Number.isSafeInteger(createdAt) || createdAt < 0) {
                throw new PaperProposalStoreError();
            }

            const proposalId = createProposalId(identity);
            const insertion = this.insertProposal.run(
                proposalId,
                identity.strategyId,
                identity.strategyVersion,
                identity.instrument,
                identity.signal,
                identity.candleTimestamp,
                createdAt,
                identity.payload,
            );
            const row = this.selectProposal.get(
                identity.strategyId,
                identity.strategyVersion,
                identity.instrument,
                identity.signal,
                identity.candleTimestamp,
            );

            if (!row) {
                throw new PaperProposalStoreError();
            }

            return {
                created: insertion.changes === 1,
                proposal: deserializeProposal(row),
            };
        }).immediate;
    }

    insert(proposal) {
        const identity = validateProposal(proposal);
        try {
            return this.insertTransaction(identity);
        } catch (error) {
            if (error instanceof PaperProposalStoreError) {
                throw error;
            }
            throw new PaperProposalStoreError();
        }
    }

    close() {
        try {
            if (this.database.open) {
                this.database.close();
            }
        } catch {
            throw new PaperProposalStoreError();
        }
    }
}

export function createPaperProposalStore(options) {
    return new PaperProposalStore(options);
}
