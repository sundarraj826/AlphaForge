import {
    PaperProposalQueryError,
} from '../storage/paper-proposal.store.mjs';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PAGE_SIZE_PATTERN = /^[1-9]\d*$/;

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });

    response.end(JSON.stringify(body));
}

function parsePageSize(value) {
    if (value === null) {
        return DEFAULT_PAGE_SIZE;
    }
    if (!PAGE_SIZE_PATTERN.test(value)) {
        throw new PaperProposalQueryError();
    }

    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit > MAX_PAGE_SIZE) {
        throw new PaperProposalQueryError();
    }
    return limit;
}

export async function handlePaperProposals(
    request,
    response,
    { store, getStore } = {},
) {
    try {
        const url = new URL(
            request.url ?? '/api/paper-proposals',
            'http://localhost',
        );
        const limitValues = url.searchParams.getAll('limit');
        const cursorValues = url.searchParams.getAll('cursor');
        if (limitValues.length > 1 || cursorValues.length > 1) {
            throw new PaperProposalQueryError();
        }

        const limit = parsePageSize(limitValues[0] ?? null);
        const cursor = cursorValues[0];
        const proposalStore = getStore ? getStore() : store;
        if (!proposalStore || typeof proposalStore.list !== 'function') {
            throw new Error('Paper-proposal storage is unavailable.');
        }

        const page = await proposalStore.list({
            limit,
            ...(cursor === undefined ? {} : { cursor }),
        });
        return sendJson(response, 200, {
            status: 'success',
            data: {
                proposals: page.proposals,
                nextCursor: page.nextCursor,
            },
        });
    } catch (error) {
        if (error instanceof PaperProposalQueryError) {
            return sendJson(response, 400, {
                status: 'error',
                message: 'Invalid paper-proposal pagination query.',
            });
        }

        return sendJson(response, 503, {
            status: 'error',
            message: 'Paper-proposal storage is unavailable.',
        });
    }
}
