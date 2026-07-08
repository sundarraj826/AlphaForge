import { Service, signal } from '@angular/core';
import { DashboardSummary } from '../models/dashboard-summary.model';

@Service()
export class DashboardService {

    readonly summary = signal<DashboardSummary>({
        totalCapital: 500000,
        todaysPnl: 2350,
        openPositions: 5,
        winRate: 68
    });
}
