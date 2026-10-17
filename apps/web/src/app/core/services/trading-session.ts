import { Service } from '@angular/core';

@Service()
export class TradingSessionService {

    getTradingDay(timestamp: number): string {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(timestamp));
    }


    isEndOfDay(timestamp: number): boolean {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(new Date(timestamp));

        const hour = Number(
            parts.find(part => part.type === 'hour')?.value
        );

        const minute = Number(
            parts.find(part => part.type === 'minute')?.value
        );

        return hour * 60 + minute >= 15 * 60 + 15;
    }


    isMarketSession(timestamp: number): boolean {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(new Date(timestamp));

        const getPart = (type: string): string =>
            parts.find(part => part.type === type)?.value ?? '';

        const weekday = getPart('weekday');
        const hour = Number(getPart('hour'));
        const minute = Number(getPart('minute'));

        const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
        const minutesSinceMidnight = hour * 60 + minute;

        const sessionStart = 9 * 60 + 15;
        const lastCandleStart = 15 * 60 + 15;

        return (
            isWeekday &&
            minutesSinceMidnight >= sessionStart &&
            minutesSinceMidnight <= lastCandleStart
        );
    }




}