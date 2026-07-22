export interface Strategy {
    id?: string;
    name: string;
    instrument: string;
    timeframe: string;
    status: 'Active' | 'Inactive';
}