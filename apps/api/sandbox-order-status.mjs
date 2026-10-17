import 'dotenv/config';

const token = process.env.UPSTOX_SANDBOX_ACCESS_TOKEN;
const orderId = '261012235141474';

if (!token) {
    throw new Error(
        'Missing UPSTOX_SANDBOX_ACCESS_TOKEN in apps/api/.env',
    );
}

const url = new URL(
    '/v2/order/details',
    'https://api-sandbox.upstox.com',
);
url.searchParams.set('order_id', orderId);

console.log('Checking Upstox Sandbox order...');
console.log('Order ID:', orderId);
console.log('Host:', url.origin);

const response = await fetch(url, {
    method: 'GET',
    headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
    },
    signal: AbortSignal.timeout(10_000),
});

console.log('HTTP status:', response.status);

const body = await response.text();

try {
    console.dir(JSON.parse(body), { depth: null });
} catch {
    console.log('Response was not valid JSON.');
    console.log(body);
}