import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PaperProposalPageResponse } from '../models/paper-proposal.model';

import { ApiService } from './api.service.js';

describe('ApiService', () => {
  let service: ApiService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('requests the relative paper-proposal endpoint without browser credentials', () => {
    let response: PaperProposalPageResponse | undefined;
    service.getPaperProposals().subscribe(value => {
      response = value;
    });

    const request = httpTestingController.expectOne('/api/paper-proposals');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ status: 'success', data: { proposals: [], nextCursor: null } });
    expect(response?.data.proposals).toEqual([]);
    expect(response?.data.nextCursor).toBeNull();
  });

  it('passes optional pagination parameters without changing the cursor value', () => {
    service.getPaperProposals({ limit: 7, cursor: 'opaque/cursor+value' }).subscribe();

    const request = httpTestingController.expectOne(
      request => request.url === '/api/paper-proposals',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('limit')).toBe('7');
    expect(request.request.params.get('cursor')).toBe('opaque/cursor+value');
    request.flush({ status: 'success', data: { proposals: [], nextCursor: null } });
  });
});
