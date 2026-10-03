import { Indicator, Operator } from '../types/trading-rule.types';

export interface ExitCondition {
    indicator: Indicator;
    operator: Operator;
    value: string | number;
}