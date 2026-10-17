
import { getUpstoxSandboxConfig } from '../config/upstox.config.mjs';

const SANDBOX_BASE_URL = 'https://api-sandbox.upstox.com';

export async function getSandboxOrderDetails(orderId, fetchImpl = fetch) {
    if (typeof orderId !== 'string' || !orderId.trim()) {
        throw new Error('A valid Sandbox order ID is required.');
    }

    if (typeof fetchImpl !== 'function') {
        throw new Error('A valid HTTP request function is required.');
    }

    const config = getUpstoxSandboxConfig();

    if (
        config.mode !== 'sandbox' ||
        config.baseUrl !== SANDBOX_BASE_URL
    ) {
        throw new Error('Safety check failed: Sandbox mode is required.');
    }

    const requestedOrderId = orderId.trim();
    const url = new URL('/v2/order/details', SANDBOX_BASE_URL);
    url.searchParams.set('order_id', requestedOrderId);

    const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error(
            `Sandbox order-details endpoint returned invalid JSON (HTTP ${response.status}).`,
        );
    }

    if (!response.ok || result?.status !== 'success') {
        const apiError = result?.errors?.[0];

        throw new Error(
            `Sandbox order-details request failed (HTTP ${response.status}): ${apiError?.errorCode ?? apiError?.error_code ?? 'UNKNOWN'
            } - ${apiError?.message ?? 'No error details provided by Upstox.'}`,
        );
    }

    if (!result.data || result.data.order_id !== requestedOrderId) {
        throw new Error(
            'Sandbox response did not match the requested order ID.',
        );
    }

    return result.data;
}
