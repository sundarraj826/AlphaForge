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

export class PaperProposalQueryError extends Error {
    constructor() {
        super('Invalid paper-proposal pagination query.');
        this.statusCode = 400;
    }
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PROPOSAL_ID_PATTERN = /^[a-f0-9]{64}$/;

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

function decodeCursor(cursor) {
    if (
        typeof cursor !== 'string' ||
        cursor.length === 0 ||
        cursor.length > 256 ||
        !/^[A-Za-z0-9_-]+$/.test(cursor)
    ) {
        throw new PaperProposalQueryError();
    }

    try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
        const value = JSON.parse(decoded);
        if (
            !value ||
            typeof value !== 'object' ||
            Object.keys(value).length !== 2 ||
            !Object.hasOwn(value, 'createdAt') ||
            !Object.hasOwn(value, 'proposalId') ||
            !Number.isSafeInteger(value.createdAt) ||
            value.createdAt < 0 ||
            typeof value.proposalId !== 'string' ||
            !PROPOSAL_ID_PATTERN.test(value.proposalId) ||
            Buffer.from(JSON.stringify(value), 'utf8').toString('base64url') !==
                cursor
        ) {
            throw new PaperProposalQueryError();
        }

        return {
            createdAt: value.createdAt,
            proposalId: value.proposalId,
        };
    } catch (error) {
        if (error instanceof PaperProposalQueryError) {
            throw error;
        }
        throw new PaperProposalQueryError();
    }
}

function encodeCursor(row) {
    return Buffer.from(
        JSON.stringify({
            createdAt: row.created_at,
            proposalId: row.proposal_id,
        }),
        'utf8',
    ).toString('base64url');
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
        this.listProposals = database.prepare(`
            SELECT * FROM paper_proposals
            WHERE (? IS NULL OR created_at < ? OR (
                created_at = ? AND proposal_id < ?
            ))
            ORDER BY created_at DESC, proposal_id DESC
            LIMIT ?
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

    list(options = {}) {
        if (
            !options ||
            typeof options !== 'object' ||
            Array.isArray(options)
        ) {
            throw new PaperProposalQueryError();
        }

        const { limit = DEFAULT_PAGE_SIZE, cursor } = options;
        if (
            !Number.isSafeInteger(limit) ||
            limit < 1 ||
            limit > MAX_PAGE_SIZE
        ) {
            throw new PaperProposalQueryError();
        }

        const decodedCursor =
            cursor === undefined || cursor === null
                ? null
                : decodeCursor(cursor);

        try {
            const rows = this.listProposals.all(
                decodedCursor?.createdAt ?? null,
                decodedCursor?.createdAt ?? null,
                decodedCursor?.createdAt ?? null,
                decodedCursor?.proposalId ?? null,
                limit + 1,
            );
            const hasMore = rows.length > limit;
            const pageRows = hasMore ? rows.slice(0, limit) : rows;
            return {
                proposals: pageRows.map(deserializeProposal),
                nextCursor: hasMore
                    ? encodeCursor(pageRows[pageRows.length - 1])
                    : null,
            };
        } catch {
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
