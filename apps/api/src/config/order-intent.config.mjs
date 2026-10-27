import 'dotenv/config';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATABASE_PATH_ENV = 'ALPHAFORGE_ORDER_INTENTS_DB_PATH';
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

export class OrderIntentConfigurationError extends Error {
    constructor() {
        super(
            'Order-intent database path is missing or invalid; configure an absolute path outside the repository.',
        );
        this.statusCode = 503;
    }
}

export function validateOrderIntentDatabasePath(databasePath) {
    if (
        typeof databasePath !== 'string' ||
        !databasePath ||
        databasePath.trim() !== databasePath ||
        !path.isAbsolute(databasePath)
    ) {
        throw new OrderIntentConfigurationError();
    }

    const resolvedPath = path.resolve(databasePath);
    if (isWithinDirectory(resolvedPath, REPOSITORY_ROOT)) {
        throw new OrderIntentConfigurationError();
    }

    try {
        let existingPath = resolvedPath;
        while (!existsSync(existingPath)) {
            const parentPath = path.dirname(existingPath);
            if (parentPath === existingPath) {
                throw new OrderIntentConfigurationError();
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
            throw new OrderIntentConfigurationError();
        }
    } catch (error) {
        if (error instanceof OrderIntentConfigurationError) {
            throw error;
        }
        throw new OrderIntentConfigurationError();
    }

    return resolvedPath;
}

export function loadOrderIntentDatabasePath(environment = process.env) {
    return validateOrderIntentDatabasePath(
        environment[DATABASE_PATH_ENV],
    );
}
