
import { inject, Service, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { MarketCandle } from '../models/market-candle.model';

type CandleSource = 'mock' | 'upstox';

interface MarketCandlesApiResponse {
    status: 'success';
    source: CandleSource;
    data: {
        candles: MarketCandle[];
    };
}

interface LoadCandlesOptions {
    source?: CandleSource;
    instrument?: string;
    fromDate?: string;
    toDate?: string;
}

@Service()
export class MarketHistoryService {
    private readonly _candles = signal<MarketCandle[]>([]);
    private readonly _loading = signal(false);
    private readonly _error = signal<string | null>(null);
    private readonly _source = signal<CandleSource | null>(null);

    readonly candles = this._candles.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly error = this._error.asReadonly();
    readonly source = this._source.asReadonly();

    private readonly _http = inject(HttpClient);

    async loadCandles(
        options: LoadCandlesOptions = {},
    ): Promise<void> {
        const source = options.source ?? 'mock';

        this._loading.set(true);
        this._error.set(null);

        try {
            let url = 'http://localhost:3000/api/market/candles';

            if (source === 'upstox') {
                if (!options.instrument || !options.fromDate || !options.toDate) {
                    throw new Error(
                        'Select a supported instrument and both start and end dates for historical data.',
                    );
                }

                url +=
                    `?source=upstox` +
                    `&instrument=${encodeURIComponent(options.instrument)}` +
                    `&fromDate=${encodeURIComponent(options.fromDate)}` +
                    `&toDate=${encodeURIComponent(options.toDate)}`;
            }

            const response = await firstValueFrom(
                this._http.get<MarketCandlesApiResponse>(url),
            );

            if (
                response.status !== 'success' ||
                response.source !== source ||
                !Array.isArray(response.data?.candles)
            ) {
                throw new Error('Invalid market candles API response.');
            }

            const candles = [...response.data.candles].sort(
                (a, b) => a.timestamp - b.timestamp,
            );

            this._candles.set(candles);
            this._source.set(response.source);
        } catch (error) {
            this._candles.set([]);
            this._source.set(null);

            this._error.set(
                error instanceof HttpErrorResponse &&
                    typeof error.error?.message === 'string'
                    ? error.error.message
                    : error instanceof Error
                        ? error.message
                        : 'Unable to load market candles. Check the AlphaForge API.',
            );
        } finally {
            this._loading.set(false);
        }
    }

    getCandles(): MarketCandle[] {
        return this._candles();
    }
}
