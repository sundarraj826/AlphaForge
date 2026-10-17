
import 'dotenv/config';

const SANDBOX_BASE_URL = 'https://api-sandbox.upstox.com';

export function getUpstoxSandboxConfig() {
    const accessToken = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN;

    if (!accessToken) {
        throw new Error(
            'Missing UPSTOX_SANDBOX_ACCESS_TOKEN in apps/api/.env',
        );
    }

    return Object.freeze({
        mode: 'sandbox',
        baseUrl: SANDBOX_BASE_URL,
        accessToken,
    });
}

export function assertSandboxOnly(client) {
    if (!client?.sandbox) {
        throw new Error(
            'Safety check failed: AlphaForge requires Upstox Sandbox mode.',
        );
    }

    if (
        client.basePath !== SANDBOX_BASE_URL ||
        client.orderBasePath !== SANDBOX_BASE_URL
    ) {
        throw new Error(
            'Safety check failed: Unexpected Upstox API host.',
        );
    }
}
