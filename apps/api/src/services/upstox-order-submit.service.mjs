
import UpstoxClient from 'upstox-js-sdk';
import { assertSandboxOnly } from '../config/upstox.config.mjs';
import { createUpstoxSandboxClient } from '../integrations/upstox/upstox-sandbox.client.mjs';

function validateLimitOrder(order) {
    if (!order || typeof order !== 'object') {
        throw new Error('A valid order object is required.');
    }

    if (
        typeof order.instrumentToken !== 'string' ||
        !order.instrumentToken.trim()
    ) {
        throw new Error('A valid instrument token is required.');
    }

    if (!Number.isSafeInteger(order.quantity) || order.quantity <= 0) {
        throw new Error('Order quantity must be a positive integer.');
    }

    if (order.product !== 'I') {
        throw new Error('Only the configured intraday product I is allowed.');
    }

    if (order.validity !== 'DAY') {
        throw new Error('Only DAY validity is supported.');
    }

    if (order.orderType !== 'LIMIT') {
        throw new Error('Only LIMIT orders are supported by this service.');
    }

    if (!['BUY', 'SELL'].includes(order.transactionType)) {
        throw new Error('Transaction type must be BUY or SELL.');
    }

    if (!Number.isFinite(order.price) || order.price <= 0) {
        throw new Error('Limit price must be a positive number.');
    }
}

export function submitSandboxLimitOrder(
    order,
    {
        clientFactory = createUpstoxSandboxClient,
        orderApiFactory = (client) => new UpstoxClient.OrderApiV3(client),
    } = {},
) {
    // Validate before creating a client or making a request.
    validateLimitOrder(order);

    const client = clientFactory();
    assertSandboxOnly(client);

    const orderApi = orderApiFactory(client);

    const request = {
        quantity: order.quantity,
        product: order.product,
        validity: order.validity,
        price: order.price,
        instrumentToken: order.instrumentToken.trim(),
        orderType: 'LIMIT',
        transactionType: order.transactionType,
        disclosedQuantity: 0,
        triggerPrice: 0,
        isAmo: false,
        slice: false,
        tag: 'alphaforge-sandbox',
    };

    return new Promise((resolve, reject) => {
        orderApi.placeOrder(request, {}, (error, data) => {
            if (error) {
                reject(new Error('Upstox Sandbox order submission failed.'));
                return;
            }

            if (
                data?.status !== 'success' ||
                !Array.isArray(data?.data?.orderIds) ||
                data.data.orderIds.length === 0
            ) {
                reject(
                    new Error('Sandbox response did not contain a successful order ID.'),
                );
                return;
            }

            resolve({
                status: data.status,
                orderIds: data.data.orderIds,
            });
        });
    });
}
