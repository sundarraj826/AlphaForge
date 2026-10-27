
import UpstoxClient from 'upstox-js-sdk';
import { assertSandboxOnly } from '../config/upstox.config.mjs';
import {
    loadSandboxOrderRiskConfig,
    validateSandboxLimitOrder,
} from '../config/order-risk.config.mjs';
import { createUpstoxSandboxClient } from '../integrations/upstox/upstox-sandbox.client.mjs';

export function submitSandboxLimitOrder(
    order,
    {
        clientFactory = createUpstoxSandboxClient,
        orderApiFactory = (client) => new UpstoxClient.OrderApiV3(client),
    } = {},
) {
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
