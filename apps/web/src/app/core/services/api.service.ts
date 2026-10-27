import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { Observable } from 'rxjs';

export interface ApiHealthResponse {
    status: string;
    service: string;
    mode: string;
}

@Service()
export class ApiService {

    private readonly _http = inject(HttpClient);

    private readonly _baseUrl = "http://localhost:3000/api"

    checkHealth(): Observable<ApiHealthResponse> {
        return this._http.get<ApiHealthResponse>(`${this._baseUrl}/health`)
    }

    getOrderDetails(orderId: string): Observable<unknown> {
        return this._http.get<unknown>(`${this._baseUrl}/orders/${encodeURIComponent(orderId.trim())}`)
    }

    getPaperProposals(): Observable<unknown> {
        return this._http.get<unknown>('/api/paper-proposals')
    }
}
