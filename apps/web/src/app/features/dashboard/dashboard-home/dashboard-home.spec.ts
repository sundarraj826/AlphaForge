import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject } from 'rxjs';

import { DashboardHome } from './dashboard-home';
import { ApiService } from '../../../core/services/api.service';
import {
  PaperProposal,
  PaperProposalPageResponse,
  PaperProposalQuery,
} from '../../../core/models/paper-proposal.model';

function createProposal(
  proposalId: string,
  side: 'BUY' | 'SELL' = 'BUY',
): PaperProposal {
  return {
    proposalId,
    strategyId: 'nifty50-intraday-trend',
    strategyVersion: 1,
    instrument: 'NIFTY50',
    signal: side,
    candleTimestamp: 1_798_000_000_000,
    createdAt: 1_798_000_900_000,
    payload: {
      status: 'PAPER_PROPOSAL',
      strategyId: 'nifty50-intraday-trend',
      strategyVersion: 1,
      instrument: 'NIFTY50',
      timeframe: '15m',
      side,
      signalTimestamp: 1_798_000_000_000,
      evaluatedAt: 1_798_000_900_000,
      referencePrice: 150,
      execution: {
        status: 'UNAVAILABLE',
        orderableInstrumentToken: null,
        quantity: null,
        limitPrice: null,
        riskCheck: 'NOT_EVALUATED',
        reason: 'Execution is not available for paper proposals.',
      },
    },
  };
}

function page(
  proposals: PaperProposal[],
  nextCursor: string | null = null,
): PaperProposalPageResponse {
  return { status: 'success', data: { proposals, nextCursor } };
}

describe('DashboardHome', () => {
  let component: DashboardHome;
  let fixture: ComponentFixture<DashboardHome>;
  let requestSubjects: Subject<PaperProposalPageResponse>[];
  let receivedQueries: (PaperProposalQuery | undefined)[];
  let apiService: Pick<ApiService, 'checkHealth' | 'getPaperProposals'>;

  beforeEach(async () => {
    requestSubjects = [new Subject<PaperProposalPageResponse>()];
    receivedQueries = [];
    apiService = {
      checkHealth: () => of({ status: 'ok', service: 'api', mode: 'sandbox' }),
      getPaperProposals: (query?: PaperProposalQuery): Observable<PaperProposalPageResponse> => {
        receivedQueries.push(query);
        const subject = requestSubjects[receivedQueries.length - 1];
        if (!subject) {
          throw new Error('No test proposal response configured.');
        }
        return subject.asObservable();
      },
    };

    await TestBed.configureTestingModule({
      imports: [DashboardHome],
      providers: [{ provide: ApiService, useValue: apiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows initial loading and renders successful proposal results as informational only', () => {
    expect(component.proposalsLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent)
      .toContain('Loading paper proposals');

    requestSubjects[0].next(page([createProposal('proposal-1')]));
    requestSubjects[0].complete();
    fixture.detectChanges();

    expect(component.proposalsLoading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('NIFTY50 · BUY');
    expect(fixture.nativeElement.textContent).toContain('risk check not evaluated');
    expect(fixture.nativeElement.textContent).not.toContain('Approved order');
  });

  it('shows an empty state when the successful page has no proposals', () => {
    requestSubjects[0].next(page([]));
    requestSubjects[0].complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No saved paper proposals yet.');
    component.loadMorePaperProposals();
    expect(receivedQueries).toHaveLength(1);
  });

  it('shows an error and retries the initial request', () => {
    requestSubjects[0].error(new Error('private storage detail'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Unable to load saved paper proposals.');
    expect(fixture.nativeElement.textContent).not.toContain('private storage detail');

    requestSubjects.push(new Subject<PaperProposalPageResponse>());
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(receivedQueries).toHaveLength(2);
    expect(component.proposalsLoading()).toBe(true);
    requestSubjects[1].next(page([createProposal('proposal-retry')]));
    requestSubjects[1].complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('NIFTY50 · BUY');
  });

  it('loads another page using the returned cursor and removes duplicate proposal IDs', () => {
    requestSubjects[0].next(page([createProposal('proposal-1')], 'opaque-cursor'));
    requestSubjects[0].complete();
    fixture.detectChanges();

    requestSubjects.push(new Subject<PaperProposalPageResponse>());
    component.loadMorePaperProposals();
    fixture.detectChanges();

    expect(receivedQueries[1]).toEqual({ cursor: 'opaque-cursor' });
    expect(component.proposalsLoadingMore()).toBe(true);

    requestSubjects[1].next(page([
      createProposal('proposal-1'),
      createProposal('proposal-2', 'SELL'),
    ]));
    requestSubjects[1].complete();
    fixture.detectChanges();

    expect(component.paperProposals().map(proposal => proposal.proposalId))
      .toEqual(['proposal-1', 'proposal-2']);
    expect(component.proposalsNextCursor()).toBeNull();
  });

  it('prevents overlapping initial and next-page requests', () => {
    component.loadPaperProposals();
    expect(receivedQueries).toHaveLength(1);

    requestSubjects[0].next(page([createProposal('proposal-1')], 'next-cursor'));
    requestSubjects[0].complete();
    fixture.detectChanges();

    requestSubjects.push(new Subject<PaperProposalPageResponse>());
    component.loadMorePaperProposals();
    component.loadMorePaperProposals();
    expect(receivedQueries).toHaveLength(2);
  });

  it('preserves loaded proposals after a next-page error and allows retry', () => {
    const firstProposal = createProposal('proposal-1');
    requestSubjects[0].next(page([firstProposal], 'retry-cursor'));
    requestSubjects[0].complete();
    fixture.detectChanges();

    requestSubjects.push(new Subject<PaperProposalPageResponse>());
    component.loadMorePaperProposals();
    requestSubjects[1].error(new Error('private storage detail'));
    fixture.detectChanges();

    expect(component.paperProposals()).toEqual([firstProposal]);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent)
      .toContain('Unable to load more paper proposals.');
    expect(fixture.nativeElement.textContent).not.toContain('private storage detail');

    requestSubjects.push(new Subject<PaperProposalPageResponse>());
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    const retryButton = Array.from(buttons).find(
      button => button.textContent?.includes('Retry loading more'),
    );
    if (!retryButton) {
      throw new Error('Expected the next-page retry button to be rendered.');
    }
    retryButton.click();
    expect(receivedQueries[2]).toEqual({ cursor: 'retry-cursor' });

    requestSubjects[2].next(page([createProposal('proposal-2')]));
    requestSubjects[2].complete();
    fixture.detectChanges();
    expect(component.paperProposals().map(proposal => proposal.proposalId))
      .toEqual(['proposal-1', 'proposal-2']);
  });
});
