import assert from 'node:assert/strict';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { createProposalProxy } from './proposal-proxy.mjs';

const configuredToken = 'test-only-local-token';
const angularBuildRequire = createRequire(import.meta.resolve('@angular/build/package.json'));
const viteModuleUrl = pathToFileURL(angularBuildRequire.resolve('vite')).href;
const { createServer: createViteServer } = await import(viteModuleUrl);

function request(method, url, headers = {}) {
    return { method, url, headers };
}

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.removeListener('error', reject);
            resolve(server.address().port);
        });
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

function sendRequest(port, path, { method = 'GET', headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const request = httpRequest({
            host: '127.0.0.1',
            port,
            path,
            method,
            headers,
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve({
                statusCode: response.statusCode,
                body: Buffer.concat(chunks).toString('utf8'),
            }));
        });
        request.once('error', reject);
        request.end();
    });
}

test('only GET requests to the exact proposal endpoint pass the proxy filter', () => {
    const proxy = createProposalProxy(configuredToken);
    const response = { statusCode: 200, ended: false, body: undefined, end(body) { this.ended = true; this.body = body; } };
    const allowed = request('GET', '/api/paper-proposals?limit=20');
    const deniedRequests = [
        request('POST', '/api/paper-proposals'),
        request('GET', '/api/paper-proposals/'),
        request('GET', '/api/paper-proposals/extra'),
        request('GET', '/api/../api/paper-proposals'),
        request('GET', '/api/%70aper-proposals'),
        request('GET', '/api/paper%2Dproposals'),
        request('GET', '/api%2Fpaper-proposals'),
        request('GET', '/api/paper-proposals%2F..%2Forders'),
        request('GET', '/api/paper-proposals\\..\\orders'),
        request('GET', '/api/%ZZ'),
        request('GET', '/api/paper-proposals#fragment'),
        request('GET', '/api/orders'),
        request('GET', 'http://example.test/api/paper-proposals'),
        request('GET', undefined),
        request('GET', '/api/paper-proposals', { Expect: '100-continue' }),
        request('GET', '/api/paper-proposals', { expect: '' }),
    ];

    assert.equal(proxy.bypass(allowed, response), undefined);
    for (const denied of deniedRequests) {
        const deniedResponse = {
            statusCode: 200,
            ended: false,
            body: undefined,
            end(body) { this.ended = true; this.body = body; },
        };
        assert.equal(proxy.bypass(denied, deniedResponse), false);
        assert.equal(deniedResponse.statusCode, 404);
        assert.equal(deniedResponse.ended, true);
        assert.equal(deniedResponse.body, undefined);
        assert.equal(String(deniedResponse.body).includes(configuredToken), false);
    }
});

test('installed Vite middleware rejects forbidden requests before the local upstream', async () => {
    const upstreamRequests = [];
    const upstream = createHttpServer((incoming, response) => {
        upstreamRequests.push({
            method: incoming.method,
            url: incoming.url,
            authorization: incoming.headers.authorization,
        });
        response.writeHead(200).end('upstream response');
    });
    const upstreamPort = await listen(upstream);

    const proxy = {
        ...createProposalProxy(configuredToken),
        target: `http://127.0.0.1:${upstreamPort}`,
    };
    const vite = await createViteServer({
        configFile: false,
        appType: 'custom',
        server: {
            middlewareMode: true,
            proxy: { '^/api(?:/|$)': proxy },
        },
    });
    const devServer = createHttpServer(vite.middlewares);
    const devServerPort = await listen(devServer);

    try {
        const deniedRequests = [
            { path: '/api/paper-proposals', method: 'POST' },
            { path: '/api/orders', method: 'GET' },
            { path: '/api/%70aper-proposals', method: 'GET' },
            { path: '/api/paper-proposals%2Fextra', method: 'GET' },
            {
                path: '/api/paper-proposals',
                method: 'GET',
                headers: { Expect: '100-continue' },
            },
        ];

        for (const denied of deniedRequests) {
            const result = await sendRequest(devServerPort, denied.path, denied);
            assert.equal(result.statusCode, 404);
            assert.equal(result.body, '');
            assert.equal(result.body.includes(configuredToken), false);
        }
        assert.deepEqual(upstreamRequests, []);

        const allowed = await sendRequest(devServerPort, '/api/paper-proposals?limit=1', {
            headers: { Authorization: 'Bearer browser-controlled' },
        });
        assert.equal(allowed.statusCode, 200);
        assert.equal(allowed.body, 'upstream response');
        assert.deepEqual(upstreamRequests, [{
            method: 'GET',
            url: '/api/paper-proposals?limit=1',
            authorization: `Bearer ${configuredToken}`,
        }]);
    } finally {
        await close(devServer);
        await vite.close();
        await close(upstream);
    }
});

test('strips browser Authorization and injects the configured Bearer header upstream', () => {
    const proxy = createProposalProxy(configuredToken);
    const incoming = request('GET', '/api/paper-proposals', {
        authorization: 'Bearer browser-controlled',
        Authorization: 'Bearer alternate-browser-value',
    });
    const response = { end() {} };
    let proxyRequestHandler;
    const upstreamHeaders = { authorization: 'Bearer browser-controlled' };
    const proxyRequest = {
        removeHeader(name) {
            delete upstreamHeaders[name.toLowerCase()];
        },
        setHeader(name, value) {
            upstreamHeaders[name.toLowerCase()] = value;
        },
    };

    proxy.configure({
        on(eventName, handler) {
            assert.equal(eventName, 'proxyReq');
            proxyRequestHandler = handler;
        },
    });

    assert.equal(proxy.bypass(incoming, response), undefined);
    assert.equal('authorization' in incoming.headers, false);
    assert.equal('Authorization' in incoming.headers, false);
    proxyRequestHandler(proxyRequest);
    assert.deepEqual(upstreamHeaders, { authorization: `Bearer ${configuredToken}` });
});

test('fails closed without a usable token and does not include token data in errors', () => {
    for (const token of [undefined, '', '   ']) {
        assert.throws(
            () => createProposalProxy(token),
            (error) => !error.message.includes(configuredToken) &&
                error.message.includes('ALPHAFORGE_LOCAL_API_TOKEN'),
        );
    }
});
