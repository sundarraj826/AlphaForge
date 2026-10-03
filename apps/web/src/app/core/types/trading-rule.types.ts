import { INDICATORS } from '../constants/indicators';
import { OPERATORS } from '../constants/operators';

export type Indicator = typeof INDICATORS[number];
export type Operator = typeof OPERATORS[number];