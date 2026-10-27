
import UpstoxClient from 'upstox-js-sdk';
import { assertSandboxOnly } from '../config/upstox.config.mjs';
import {
    loadSandboxOrderRiskConfig,
    validateSandboxLimitOrder,
} from '../config/order-risk.config.mjs';
import { createUpstoxSandboxClient } from '../integrations/upstox/upstox-sandbox.client.mjs';

const DEFAULT_SUBMISSION_TIMEOUT_MS = 30_000;

export class ConfirmedSandboxOrderRejectionError extends Error {
    constructor() {
        super('Upstox Sandbox confirmed that the order was rejected.');
    }
}

export class UnknownSandboxOrderOutcomeError extends Error {
    constructor() {
        super('Upstox Sandbox order submission outcome is unknown.');
    }
}

export function submitSandboxLimitOrder(
    order,
    {
        clientFactory = createUpstoxSandboxClient,
        orderApiFactory = (client) => new UpstoxClient.OrderApiV3(client),
        submissionTimeoutMs = DEFAULT_SUBMISSION_TIMEOUT_MS,
    } = {},
) {
    if (
        !Number.isSafeInteger(submissionTimeoutMs) ||
        submissionTimeoutMs <= 0
    ) {
        throw new Error('A valid Sandbox submission timeout is required.');
    }

    // Validate before creating a client or making a request.
    const riskConfig = loadSandboxOrderRiskConfig();
    const validatedOrder = validateSandboxLimitOrder(order, riskConfig);

    const client = clientFactory();
    assertSandboxOnly(client);

    const orderApi = orderApiFactory(client);

    const request = {
        quantity: validatedOrder.quantity,
        product: validatedOrder.product,
        validity: validatedOrder.validity,
        price: validatedOrder.price,
        instrumentToken: validatedOrder.instrumentToken,
        orderType: 'LIMIT',
        transactionType: validatedOrder.transactionType,
        disclosedQuantity: 0,
        triggerPrice: 0,
        isAmo: false,
        slice: false,
        tag: 'alphaforge-sandbox',
    };

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, value) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            callback(value);
        };
        const timeout = setTimeout(
            () => finish(
                reject,
                new UnknownSandboxOrderOutcomeError(),
            ),
            submissionTimeoutMs,
        );

        try {
            orderApi.placeOrder(request, {}, (error, data) => {
                if (error) {
                    finish(reject, new UnknownSandboxOrderOutcomeError());
                    return;
                }

                if (
                    data?.status === 'error' &&
                    Array.isArray(data?.errors) &&
                    data.errors.length > 0
                ) {
                    finish(
                        reject,
                        new ConfirmedSandboxOrderRejectionError(),
                    );
                    return;
                }

                if (
                    data?.status !== 'success' ||
                    !Array.isArray(data?.data?.orderIds) ||
                    data.data.orderIds.length === 0 ||
                    !data.data.orderIds.every(
                        orderId =>
                            typeof orderId === 'string' &&
                            orderId.trim().length > 0,
                    )
                ) {
                    finish(reject, new UnknownSandboxOrderOutcomeError());
                    return;
                }

                finish(resolve, {
                    status: data.status,
                    orderIds: data.data.orderIds.map(orderId =>
                        orderId.trim(),
                    ),
                });
            });
        } catch {
            finish(reject, new UnknownSandboxOrderOutcomeError());
        }
    });
}
