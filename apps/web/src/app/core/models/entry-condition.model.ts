import { Indicator, Operator } from '../types/trading-rule.types';

export interface EntryCondition {
    indicator: Indicator;
    operator: Operator;
    value: string | number;
}