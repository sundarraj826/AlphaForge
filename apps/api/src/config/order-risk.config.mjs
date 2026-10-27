import 'dotenv/config';

const INSTRUMENT_LIST_ENV = 'UPSTOX_SANDBOX_ALLOWED_INSTRUMENTS';
const MAX_QUANTITY_ENV = 'UPSTOX_SANDBOX_MAX_ORDER_QUANTITY';
const MAX_NOTIONAL_ENV = 'UPSTOX_SANDBOX_MAX_ORDER_NOTIONAL';
const DECIMAL_SCALE = 6;
const MAX_INTEGER_DIGITS = 15;
const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export class OrderRiskConfigurationError extends Error {
    constructor() {
        super('Sandbox order risk configuration is missing or invalid.');
        this.statusCode = 503;
    }
}

export class OrderValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}

function decimalToScaledInteger(value, errorFactory) {
    const decimal = typeof value === 'number'
        ? Number.isFinite(value)
            ? value.toString()
            : ''
        : value;
    const match =
        typeof decimal === 'string'
            ? DECIMAL_PATTERN.exec(decimal)
            : null;

    if (
        !match ||
        match[1].length > MAX_INTEGER_DIGITS ||
        (match[2]?.length ?? 0) > DECIMAL_SCALE
    ) {
        throw errorFactory();
    }

    const fractional = (match[2] ?? '').padEnd(DECIMAL_SCALE, '0');
    const scaled = BigInt(match[1]) * 10n ** BigInt(DECIMAL_SCALE) +
        BigInt(fractional || '0');

    if (scaled <= 0n) {
        throw errorFactory();
    }

    return scaled;
}

export function validateSandboxOrderRiskConfig(config) {
    if (
        !config ||
        !Array.isArray(config.allowedInstruments) ||
        config.allowedInstruments.length === 0 ||
        config.allowedInstruments.some(
            instrument =>
                typeof instrument !== 'string' ||
                instrument.length === 0 ||
                instrument.trim() !== instrument,
        ) ||
        new Set(config.allowedInstruments).size !== config.allowedInstruments.length ||
        !Number.isSafeInteger(config.maxQuantity) ||
        config.maxQuantity <= 0
    ) {
        throw new OrderRiskConfigurationError();
    }

    decimalToScaledInteger(
        config.maxNotional,
        () => new OrderRiskConfigurationError(),
    );

    return config;
}

export function loadSandboxOrderRiskConfig(environment = process.env) {
    const rawInstruments = environment[INSTRUMENT_LIST_ENV];
    const rawMaxQuantity = environment[MAX_QUANTITY_ENV];
    const rawMaxNotional = environment[MAX_NOTIONAL_ENV];

    if (
        typeof rawInstruments !== 'string' ||
        typeof rawMaxQuantity !== 'string' ||
        !/^[1-9]\d*$/.test(rawMaxQuantity) ||
        !Number.isSafeInteger(Number(rawMaxQuantity)) ||
        typeof rawMaxNotional !== 'string'
    ) {
        throw new OrderRiskConfigurationError();
    }

    const allowedInstruments = rawInstruments
        .split(',')
        .map(instrument => instrument.trim());
    const maxQuantity = Number(rawMaxQuantity);
    const maxNotional = rawMaxNotional;

    return validateSandboxOrderRiskConfig({
        allowedInstruments,
        maxQuantity,
        maxNotional,
    });
}

export function validateSandboxLimitOrder(order, riskConfig) {
    validateSandboxOrderRiskConfig(riskConfig);

    if (!order || typeof order !== 'object' || Array.isArray(order)) {
        throw new OrderValidationError('A valid order object is required.');
    }

    const snapshot = {
        instrumentToken: order.instrumentToken,
        quantity: order.quantity,
        price: order.price,
        product: order.product,
        validity: order.validity,
        orderType: order.orderType,
        transactionType: order.transactionType,
    };

    if (!Number.isSafeInteger(snapshot.quantity) || snapshot.quantity <= 0) {
        throw new OrderValidationError(
            'Order quantity must be a positive safe integer.',
        );
    }

    if (
        typeof snapshot.instrumentToken !== 'string' ||
        !snapshot.instrumentToken.trim()
    ) {
        throw new OrderValidationError('A valid instrument token is required.');
    }

    const instrumentToken = snapshot.instrumentToken.trim();

    if (!riskConfig.allowedInstruments.includes(instrumentToken)) {
        throw new OrderValidationError(
            'The requested instrument is not approved for Sandbox orders.',
            422,
        );
    }

    const priceScaled = decimalToScaledInteger(
        snapshot.price,
        () => new OrderValidationError(
            'Limit price must be a positive decimal with at most six fractional digits and fifteen integer digits.',
        ),
    );
    if (typeof snapshot.price !== 'number') {
        throw new OrderValidationError('Limit price must be a JSON number.');
    }

    if (snapshot.product !== 'I') {
        throw new OrderValidationError(
            'Only the configured intraday product I is allowed.',
        );
    }

    if (snapshot.validity !== 'DAY') {
        throw new OrderValidationError('Only DAY validity is supported.');
    }

    if (snapshot.orderType !== 'LIMIT') {
        throw new OrderValidationError(
            'Only LIMIT orders are supported by this service.',
        );
    }

    if (!['BUY', 'SELL'].includes(snapshot.transactionType)) {
        throw new OrderValidationError(
            'Transaction type must be BUY or SELL.',
        );
    }

    if (snapshot.quantity > riskConfig.maxQuantity) {
        throw new OrderValidationError(
            'Order quantity exceeds the configured maximum.',
            422,
        );
    }

    const maxNotionalScaled = decimalToScaledInteger(
        riskConfig.maxNotional,
        () => new OrderRiskConfigurationError(),
    );
    const orderNotionalScaled = BigInt(snapshot.quantity) * priceScaled;

    if (orderNotionalScaled > maxNotionalScaled) {
        throw new OrderValidationError(
            'Order notional exceeds the configured maximum.',
            422,
        );
    }

    return {
        ...snapshot,
        instrumentToken,
    };
}
