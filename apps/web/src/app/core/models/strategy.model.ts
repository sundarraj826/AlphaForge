import { EntryCondition } from "./entry-condition.model";
import { ExitCondition } from "./exit-condition.model";
import { RiskManagement } from "./risk-management.model";
import { TradingMarket } from "./trading-cost.model";

export interface Strategy {
    id: string;
    name: string;
    instrument: string;
    market: TradingMarket;
    timeframe: string;
    status: 'Active' | 'Inactive';
    type?: 'GENERIC' | 'INTRADAY';
    entryConditions?: EntryCondition[];
    exitConditions?: ExitCondition[];
    riskManagement?: RiskManagement;
}