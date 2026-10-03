import { EntryCondition } from "./entry-condition.model";
import { ExitCondition } from "./exit-condition.model";
import { RiskManagement } from "./risk-management.model";

export interface Strategy {
    id: string;
    name: string;
    instrument: string;
    timeframe: string;
    status: 'Active' | 'Inactive';
    entryConditions?: EntryCondition[];
    exitConditions?: ExitCondition[];
    riskManagement?: RiskManagement;
}