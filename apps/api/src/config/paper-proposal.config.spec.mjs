import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
    loadPaperProposalDatabasePath,
    PaperProposalConfigurationError,
    validatePaperProposalDatabasePath,
} from './paper-proposal.config.mjs';

test('loads an absolute paper-proposal database path outside the repository', () => {
    const temporaryDirectory = mkdtempSync(
        path.join(tmpdir(), 'alphaforge-proposal-config-'),
    );
    try {
        const databasePath = path.join(
            temporaryDirectory,
            'paper-proposals.sqlite',
        );
        assert.equal(
            loadPaperProposalDatabasePath({
                ALPHAFORGE_PAPER_PROPOSALS_DB_PATH: databasePath,
            }),
            databasePath,
        );
    } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
});

test('rejects missing, relative, and repository-local database paths', () => {
    assert.throws(
        () => loadPaperProposalDatabasePath({}),
        PaperProposalConfigurationError,
    );
    assert.throws(
        () =>
            validatePaperProposalDatabasePath(
                'data/paper-proposals.sqlite',
            ),
        PaperProposalConfigurationError,
    );
    assert.throws(
        () => validatePaperProposalDatabasePath(process.cwd()),
        PaperProposalConfigurationError,
    );
});
