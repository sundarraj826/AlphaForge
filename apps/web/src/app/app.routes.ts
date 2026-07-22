import { Routes } from '@angular/router';
import { DashboardHome } from './features/dashboard/dashboard-home/dashboard-home';
import { MarketWatch } from './features/market-watch/market-watch';
import { Portfolio } from './features/portfolio/portfolio';
import { StrategyHome } from './features/strategy/strategy-home';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        component: DashboardHome,
    },
    {
        path: 'dashboard',
        component: DashboardHome,
    },
    {
        path: 'market-watch',
        component: MarketWatch
    },
    {
        path: 'portfolio',
        component: Portfolio
    },
    {
        path: 'strategy',
        component: StrategyHome
    }
];
