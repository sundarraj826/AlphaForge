export interface PaperProposalPayload {
    status: 'PAPER_PROPOSAL';
    strategyId: string;
    strategyVersion: number;
    instrument: string;
    timeframe: string;
    side: 'BUY' | 'SELL';
    signalTimestamp: number;
    evaluatedAt: number;
    referencePrice: number;
    execution: {
        status: 'UNAVAILABLE';
        orderableInstrumentToken: null;
        quantity: null;
        limitPrice: null;
        riskCheck: 'NOT_EVALUATED';
        reason: string;
    };
}

export interface PaperProposal {
    proposalId: string;
    strategyId: string;
    strategyVersion: number;
    instrument: string;
    signal: 'BUY' | 'SELL';
    candleTimestamp: number;
    createdAt: number;
    payload: PaperProposalPayload;
}

export interface PaperProposalPageResponse {
    status: 'success';
    data: {
        proposals: PaperProposal[];
        nextCursor: string | null;
    };
}

export interface PaperProposalQuery {
    limit?: number;
    cursor?: string;
}
