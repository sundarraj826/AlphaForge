
import 'dotenv/config';
import { createServer as createHttpServer } from 'node:http';

import { submitSandboxLimitOrder } from './services/upstox-order-submit.service.mjs';
import { getSandboxOrderDetails } from './services/upstox-order.service.mjs';
import { handleMarketCandles } from './routes/market-candles.routes.mjs';


const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_SIZE = 1024 * 1024;

const ALLOWED_ORIGIN = 'http://localhost:4200';

function setCorsHeaders(request, response) {
    const origin = request.headers.origin;

    if (origin === ALLOWED_ORIGIN) {
        response.setHeader(
            'Access-Control-Allow-Origin',
            ALLOWED_ORIGIN,
        );
        response.setHeader(
            'Vary',
            'Origin',
        );
        response.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, OPTIONS',
        );
        response.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type',
        );
    }
}

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
    });

    response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
    let body = '';
    let size = 0;

    for await (const chunk of request) {
        size += chunk.length;

        if (size > MAX_BODY_SIZE) {
            const error = new Error('Request body is too large.');
            error.statusCode = 413;
            throw error;
        }

        body += chunk.toString('utf8');
    }

    try {
        return JSON.parse(body);
    } catch {
        const error = new Error('A valid JSON request body is required.');
        error.statusCode = 400;
        throw error;
    }
}

export function createApiServer() {
    return createHttpServer(async (request, response) => {
        setCorsHeaders(request, response);

        if (
            request.method === 'OPTIONS' &&
            request.headers.origin !== ALLOWED_ORIGIN
        ) {
            response.writeHead(403);
            response.end();
            return;
        }

        if (request.method === 'OPTIONS') {
            response.writeHead(204);
            response.end();
            return;
        }

        try {
            const url = new URL(
                request.url ?? '/',
                'http://localhost',
            );

            if (
                request.method === 'GET' &&
                url.pathname === '/api/health'
            ) {
                return sendJson(response, 200, {
                    status: 'ok',
                    service: 'alphaforge-api',
                    mode: 'sandbox',
                });
            }

            if (
                request.method === 'GET' &&
                url.pathname === '/api/market/candles'
            ) {
                return handleMarketCandles(request, response);
            }

            if (
                request.method === 'GET' &&
                url.pathname.startsWith('/api/orders/')
            ) {
                const orderId = decodeURIComponent(
                    url.pathname.slice('/api/orders/'.length),
                );

                const order = await getSandboxOrderDetails(orderId);

                return sendJson(response, 200, {
                    status: 'success',
                    data: order,
                });
            }

            if (
                request.method === 'POST' &&
                url.pathname === '/api/orders'
            ) {
                const order = await readJsonBody(request);

                const result = await submitSandboxLimitOrder(order);

                return sendJson(response, 201, {
                    status: 'success',
                    data: result,
                });
            }

            return sendJson(response, 404, {
                status: 'error',
                message: 'API endpoint not found.',
            });
        } catch (error) {
            if (response.headersSent) {
                response.destroy();
                return;
            }

            const statusCode = error.statusCode ?? 502;

            return sendJson(response, statusCode, {
                status: 'error',
                message:
                    statusCode === 400 || statusCode === 413
                        ? error.message
                        : 'The API request could not be completed.',
            });
        }
    });
}

const isMainModule =
    process.argv[1] &&
    import.meta.url === new URL(
        `file://${process.argv[1].replaceAll('\\', '/')}`,
    ).href;

if (isMainModule) {
    const server = createApiServer();

    server.listen(PORT, () => {
        console.log(`AlphaForge API listening on port ${PORT}`);
        console.log('Trading mode: Upstox Sandbox only');
    });
}
