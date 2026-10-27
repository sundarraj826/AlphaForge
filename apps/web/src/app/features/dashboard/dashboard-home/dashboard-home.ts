
import { Component, inject, OnInit } from '@angular/core';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';
import { DashboardService } from '../../../core/services/dashboard';
import { ApiService } from '../../../core/services/api.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-dashboard-home',
  imports: [SummaryCard],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome implements OnInit {
  readonly dashboardService = inject(DashboardService);
  readonly apiService = inject(ApiService);
  private readonly _cdr = inject(ChangeDetectorRef)

  readonly summary = this.dashboardService.summary;

  apiStatus = 'Checking...';

  ngOnInit(): void {
    this.apiService.checkHealth().subscribe({
      next: (response) => {
        this.apiStatus =
          response.status === 'ok' && response.mode === 'sandbox'
            ? 'Connected — Sandbox'
            : 'Unexpected API response';
        this._cdr.detectChanges();
      },
      error: () => {
        this.apiStatus = 'Disconnected';
        this._cdr.detectChanges();
      },
    });
  }
}
