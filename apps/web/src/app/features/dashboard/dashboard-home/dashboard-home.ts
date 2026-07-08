import { Component, inject, OnInit } from '@angular/core';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';
import { DashboardService } from '../../../core/services/dashboard';

@Component({
  selector: 'app-dashboard-home',
  imports: [SummaryCard],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome implements OnInit {

  readonly dashboardService = inject(DashboardService);
  readonly summary = this.dashboardService.summary;


  ngOnInit() {

  }
}
