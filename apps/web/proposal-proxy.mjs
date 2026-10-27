const API_ORIGIN = 'http://127.0.0.1:3000';
const PROPOSALS_PATH = '/api/paper-proposals';

function hasExpectHeader(request) {
    return request.headers &&
        Object.keys(request.headers).some((name) => name.toLowerCase() === 'expect');
}

function isAllowedProposalRequest(request) {
    if (hasExpectHeader(request) ||
        request.method !== 'GET' ||
        typeof request.url !== 'string' ||
        !request.url.startsWith('/')) {
        return false;
    }

    try {
        const url = new URL(request.url, API_ORIGIN);
        const requestPath = request.url.split('?', 1)[0];
        return url.origin === API_ORIGIN &&
            requestPath === PROPOSALS_PATH &&
            url.pathname === PROPOSALS_PATH &&
            !request.url.includes('#');
    } catch {
        return false;
    }
}

function stripAuthorizationHeader(headers) {
    delete headers.authorization;
    delete headers.Authorization;
}

export function createProposalProxy(token) {
    if (typeof token !== 'string' || token.length === 0 || token.trim() !== token) {
        throw new Error('ALPHAFORGE_LOCAL_API_TOKEN is required to start the local proposal proxy.');
    }

    return {
        target: API_ORIGIN,
        bypass(request, response) {
            if (!isAllowedProposalRequest(request)) {
                if (response) {
                    response.statusCode = 404;
                    response.end();
                }
                return false;
            }

            stripAuthorizationHeader(request.headers);
            return undefined;
        },
        configure(proxy) {
            proxy.on('proxyReq', (proxyRequest) => {
                proxyRequest.removeHeader('authorization');
                proxyRequest.setHeader('Authorization', `Bearer ${token}`);
            });
        },
    };
}
