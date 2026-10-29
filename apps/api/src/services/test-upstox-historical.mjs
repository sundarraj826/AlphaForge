import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function runHistoricalCandleProbe() {
    throw new Error(
        'Historical candle probe is disabled because no Sandbox endpoint is verified.',
    );
}

const invokedPath = process.argv[1]
    ? pathToFileURL(resolve(process.argv[1])).href
    : null;

if (invokedPath === import.meta.url) {
    try {
        runHistoricalCandleProbe();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
