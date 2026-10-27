import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATABASE_PATH_ENV = 'ALPHAFORGE_PAPER_PROPOSALS_DB_PATH';
const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../..',
);
const REAL_REPOSITORY_ROOT = realpathSync(REPOSITORY_ROOT);

function isWithinDirectory(candidate, directory) {
    const relativePath = path.relative(directory, candidate);
    return (
        relativePath === '' ||
        (!relativePath.startsWith(`..${path.sep}`) &&
            relativePath !== '..' &&
            !path.isAbsolute(relativePath))
    );
}

export class PaperProposalConfigurationError extends Error {
    constructor() {
        super(
            'Paper-proposal database path is missing or invalid; configure an absolute path outside the repository.',
        );
        this.statusCode = 503;
    }
}

export function validatePaperProposalDatabasePath(databasePath) {
    if (
        typeof databasePath !== 'string' ||
        !databasePath ||
        databasePath.trim() !== databasePath ||
        !path.isAbsolute(databasePath)
    ) {
        throw new PaperProposalConfigurationError();
    }

    const resolvedPath = path.resolve(databasePath);
    if (isWithinDirectory(resolvedPath, REPOSITORY_ROOT)) {
        throw new PaperProposalConfigurationError();
    }

    try {
        let existingPath = resolvedPath;
        while (!existsSync(existingPath)) {
            const parentPath = path.dirname(existingPath);
            if (parentPath === existingPath) {
                throw new PaperProposalConfigurationError();
            }
            existingPath = parentPath;
        }

        const physicalExistingPath = realpathSync(existingPath);
        const remainingPath = path.relative(existingPath, resolvedPath);
        const physicalDatabasePath = path.resolve(
            physicalExistingPath,
            remainingPath,
        );
        if (isWithinDirectory(physicalDatabasePath, REAL_REPOSITORY_ROOT)) {
            throw new PaperProposalConfigurationError();
        }
    } catch (error) {
        if (error instanceof PaperProposalConfigurationError) {
            throw error;
        }
        throw new PaperProposalConfigurationError();
    }

    return resolvedPath;
}

export function loadPaperProposalDatabasePath(environment = process.env) {
    return validatePaperProposalDatabasePath(
        environment[DATABASE_PATH_ENV],
    );
}
