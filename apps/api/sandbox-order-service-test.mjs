
import { getSandboxOrderDetails } from './src/services/upstox-order.service.mjs';

const orderId = '261012235141474';

try {
    const order = await getSandboxOrderDetails(orderId);

    console.log('Sandbox order details retrieved successfully.');
    console.log({
        orderId: order.order_id,
        instrument: order.tradingsymbol,
        status: order.status,
        quantity: order.quantity,
        filledQuantity: order.filled_quantity,
        orderType: order.order_type,
        transactionType: order.transaction_type,
    });
} catch (error) {
    console.error('Sandbox order-details check failed:', error.message);
    process.exitCode = 1;
}
