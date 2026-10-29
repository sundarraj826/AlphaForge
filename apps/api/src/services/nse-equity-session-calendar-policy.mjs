const INDIA_TIME_ZONE = 'Asia/Kolkata';
const MILLISECONDS_PER_MINUTE = 60_000;
const SUPPORTED_TIMEFRAME_DURATIONS_MS = Object.freeze({
    '15m': 15 * MILLISECONDS_PER_MINUTE,
});

const INDIA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
});

export class NseEquityCalendarPolicyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NseEquityCalendarPolicyError';
    }
}

function isRecord(value) {
    return value !== null && typeof value === 'object' &&
        !Array.isArray(value) &&
        (Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null);
}

function parseClockTime(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        throw new NseEquityCalendarPolicyError(
            'Calendar session times must use valid HH:mm values.',
        );
    }
    const [hour, minute] = value.split(':').map(Number);
    return (hour * 60 + minute) * MILLISECONDS_PER_MINUTE;
}

function parseSessions(sessions) {
    if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new NseEquityCalendarPolicyError(
            'A trading date must provide at least one session.',
        );
    }

    const parsed = sessions.map(session => {
        if (!isRecord(session)) {
            throw new NseEquityCalendarPolicyError(
                'Calendar sessions must be objects.',
            );
        }
        const start = parseClockTime(session.open);
        const end = parseClockTime(session.close);
        if (end <= start) {
            throw new NseEquityCalendarPolicyError(
                'Calendar sessions must open before they close on the same date.',
            );
        }
        return { start, end };
    }).sort((left, right) => left.start - right.start);

    for (let index = 1; index < parsed.length; index += 1) {
        if (parsed[index].start < parsed[index - 1].end) {
            throw new NseEquityCalendarPolicyError(
                'Calendar sessions must not overlap.',
            );
        }
    }

    return parsed;
}

function validateDateKey(date) {
    let isValidDate = false;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        try {
            isValidDate =
                new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
        } catch {
            isValidDate = false;
        }
    }
    if (!isValidDate) {
        throw new NseEquityCalendarPolicyError(
            'Calendar dates must be valid YYYY-MM-DD values.',
        );
    }
}

function parseCalendarData(calendarData) {
    if (!isRecord(calendarData) || calendarData.timeZone !== INDIA_TIME_ZONE) {
        throw new NseEquityCalendarPolicyError(
            `Calendar data must declare the ${INDIA_TIME_ZONE} timezone.`,
        );
    }
    if (!isRecord(calendarData.sessionTemplates) || !isRecord(calendarData.dates)) {
        throw new NseEquityCalendarPolicyError(
            'Calendar data must include sessionTemplates and dates.',
        );
    }

    const templates = new Map();
    for (const [name, sessions] of Object.entries(calendarData.sessionTemplates)) {
        if (!name || name !== name.trim()) {
            throw new NseEquityCalendarPolicyError(
                'Calendar session template names are invalid.',
            );
        }
        templates.set(name, parseSessions(sessions));
    }

    const dates = new Map();
    for (const [date, entry] of Object.entries(calendarData.dates)) {
        validateDateKey(date);
        if (!isRecord(entry)) {
            throw new NseEquityCalendarPolicyError(
                'Calendar date entries must be objects.',
            );
        }
        if (entry.status === 'HOLIDAY' || entry.status === 'UNKNOWN') {
            if (
                Object.hasOwn(entry, 'sessionTemplate') ||
                Object.hasOwn(entry, 'sessions')
            ) {
                throw new NseEquityCalendarPolicyError(
                    'Non-trading calendar dates cannot define sessions.',
                );
            }
            dates.set(date, { status: entry.status });
            continue;
        }
        if (entry.status !== 'TRADING') {
            throw new NseEquityCalendarPolicyError(
                'Calendar date status must be TRADING, HOLIDAY, or UNKNOWN.',
            );
        }

        const hasSessionTemplate = Object.hasOwn(entry, 'sessionTemplate');
        const hasInlineSessions = Object.hasOwn(entry, 'sessions');
        if (hasSessionTemplate === hasInlineSessions) {
            throw new NseEquityCalendarPolicyError(
                'Trading dates must define exactly one session source.',
            );
        }

        let sessions;
        if (hasSessionTemplate) {
            if (typeof entry.sessionTemplate !== 'string') {
                throw new NseEquityCalendarPolicyError(
                    'Trading date sessionTemplate must be a string.',
                );
            }
            sessions = templates.get(entry.sessionTemplate);
            if (!sessions) {
                throw new NseEquityCalendarPolicyError(
                    'Trading date references an unknown session template.',
                );
            }
        } else {
            sessions = parseSessions(entry.sessions);
        }
        dates.set(date, { status: 'TRADING', sessions });
    }

    return dates;
}

function getIndiaDateAndTime(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        throw new NseEquityCalendarPolicyError(
            'Candle start time is outside the supported date range.',
        );
    }

    const parts = Object.fromEntries(
        INDIA_DATE_TIME_FORMATTER.formatToParts(date)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)]),
    );
    const dateKey = [
        String(parts.year).padStart(4, '0'),
        String(parts.month).padStart(2, '0'),
        String(parts.day).padStart(2, '0'),
    ].join('-');
    const timeOfDay =
        (((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000) +
        parts.fractionalSecond;

    return { dateKey, timeOfDay };
}

function getConfiguredDuration(timeframe) {
    if (!Object.hasOwn(SUPPORTED_TIMEFRAME_DURATIONS_MS, timeframe)) {
        throw new NseEquityCalendarPolicyError(
            'The candle timeframe is unsupported by the calendar policy.',
        );
    }
    return SUPPORTED_TIMEFRAME_DURATIONS_MS[timeframe];
}

/**
 * Creates an NSE equity session policy from explicit, injected calendar data.
 * Calendar data is configuration only; this does not confirm provider candle finality.
 */
export function createNseEquitySessionCalendarPolicy(calendarData) {
    const dates = parseCalendarData(calendarData);

    return Object.freeze({
        getCandleEndTime({ candleStartTime, nominalDurationMs, timeframe } = {}) {
            if (
                !Number.isSafeInteger(candleStartTime) || candleStartTime < 0 ||
                !Number.isSafeInteger(nominalDurationMs) || nominalDurationMs <= 0
            ) {
                throw new NseEquityCalendarPolicyError(
                    'Candle start and duration must be positive safe integer milliseconds.',
                );
            }
            const expectedDuration = getConfiguredDuration(timeframe);
            if (nominalDurationMs !== expectedDuration) {
                throw new NseEquityCalendarPolicyError(
                    'Candle duration does not match the configured timeframe.',
                );
            }

            const { dateKey, timeOfDay } = getIndiaDateAndTime(candleStartTime);
            const dateEntry = dates.get(dateKey);
            if (!dateEntry) {
                throw new NseEquityCalendarPolicyError(
                    'Calendar data is missing for the candle date.',
                );
            }
            if (dateEntry.status !== 'TRADING') {
                throw new NseEquityCalendarPolicyError(
                    `Calendar date is marked ${dateEntry.status.toLowerCase()}.`,
                );
            }

            const session = dateEntry.sessions.find(
                candidate => timeOfDay >= candidate.start &&
                    timeOfDay < candidate.end,
            );
            if (!session) {
                throw new NseEquityCalendarPolicyError(
                    'Candle starts outside a supplied trading session.',
                );
            }

            const candleEndTime = candleStartTime + nominalDurationMs;
            const remainingSessionTime = session.end - timeOfDay;
            if (
                !Number.isSafeInteger(candleEndTime) ||
                nominalDurationMs > remainingSessionTime
            ) {
                throw new NseEquityCalendarPolicyError(
                    'Candle crosses a supplied session boundary.',
                );
            }

            const offsetFromOpen = timeOfDay - session.start;
            if (offsetFromOpen % nominalDurationMs !== 0) {
                throw new NseEquityCalendarPolicyError(
                    'Candle start is not aligned to the supplied session.',
                );
            }

            return candleEndTime;
        },
    });
}
