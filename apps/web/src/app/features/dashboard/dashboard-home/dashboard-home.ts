
import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';
import { DashboardService } from '../../../core/services/dashboard';
import { ApiService } from '../../../core/services/api.service';
import { ChangeDetectorRef } from '@angular/core';
import {
  PaperProposal,
  PaperProposalPageResponse,
} from '../../../core/models/paper-proposal.model';

@Component({
  selector: 'app-dashboard-home',
  imports: [SummaryCard, DatePipe, DecimalPipe],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome implements OnInit {
  readonly dashboardService = inject(DashboardService);
  readonly apiService = inject(ApiService);
  private readonly _cdr = inject(ChangeDetectorRef)

  readonly summary = this.dashboardService.summary;

  apiStatus = 'Checking...';
  readonly paperProposals = signal<PaperProposal[]>([]);
  readonly proposalsLoading = signal(false);
  readonly proposalsLoadingMore = signal(false);
  readonly proposalsError = signal('');
  readonly proposalsNextCursor = signal<string | null>(null);

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
    this.loadPaperProposals();
  }

  loadPaperProposals(): void {
    if (this.proposalsLoading() || this.proposalsLoadingMore()) {
      return;
    }

    this.proposalsLoading.set(true);
    this.proposalsError.set('');
    this.apiService.getPaperProposals().subscribe({
      next: (response) => this.applyProposalPage(response, false),
      error: () => {
        this.proposalsError.set('Unable to load saved paper proposals.');
        this.proposalsLoading.set(false);
      },
    });
  }

  loadMorePaperProposals(): void {
    const cursor = this.proposalsNextCursor();
    if (
      !cursor ||
      this.proposalsLoading() ||
      this.proposalsLoadingMore()
    ) {
      return;
    }

    this.proposalsLoadingMore.set(true);
    this.proposalsError.set('');
    this.apiService.getPaperProposals({ cursor }).subscribe({
      next: (response) => this.applyProposalPage(response, true),
      error: () => {
        this.proposalsError.set('Unable to load more paper proposals.');
        this.proposalsLoadingMore.set(false);
      },
    });
  }

  private applyProposalPage(
    response: PaperProposalPageResponse,
    append: boolean,
  ): void {
    const existing = append ? this.paperProposals() : [];
    const seen = new Set(existing.map(proposal => proposal.proposalId));
    const uniqueProposals = response.data.proposals.filter(proposal => {
      if (seen.has(proposal.proposalId)) {
        return false;
      }
      seen.add(proposal.proposalId);
      return true;
    });

    this.paperProposals.set([...existing, ...uniqueProposals]);
    this.proposalsNextCursor.set(response.data.nextCursor ?? null);
    this.proposalsError.set('');
    this.proposalsLoading.set(false);
    this.proposalsLoadingMore.set(false);
  }
}
