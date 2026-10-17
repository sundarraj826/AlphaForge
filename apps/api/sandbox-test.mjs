
import 'dotenv/config';
import UpstoxClient from 'upstox-js-sdk';

const token = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN;

if (!token) {
    throw new Error(
        'Missing UPSTOX_SANDBOX_ACCESS_TOKEN in apps/api/.env',
    );
}

const client = new UpstoxClient.ApiClient(true);

// Fail safely if the SDK is not configured for Sandbox.
if (!client.basePath?.includes('api-sandbox.upstox.com')) {
    throw new Error('Safety check failed: Sandbox URL is not configured.');
}

client.authentications.OAUTH2.accessToken = token;

const orderApi = new UpstoxClient.OrderApiV3(client);

const request = {
    quantity: 1,
    product: 'D',
    validity: 'DAY',
    price: 1,
    tag: 'af-sandbox-test-01',
    instrumentToken: 'NSE_EQ|INE669E01016',
    orderType: 'LIMIT',
    transactionType: 'BUY',
    disclosedQuantity: 0,
    triggerPrice: 0,
    isAmo: false,
    slice: false,
};

console.log('Submitting one-unit LIMIT order to Sandbox...');
console.log('Sandbox URL:', client.basePath);
console.log('Instrument:', request.instrumentToken);
console.log('Order type:', request.orderType);
console.log('Quantity:', request.quantity);
console.log('Limit price:', request.price);

orderApi.placeOrder(request, {}, (error, data, response) => {
    if (error) {
        console.error('Sandbox request failed.');

        if (error.response?.text) {
            console.error('API response:', error.response.text);
        } else {
            console.error('Error:', error.message ?? String(error));
        }

        return;
    }

    console.log('Sandbox API response received.');
    console.dir(data, { depth: null });
});
