import { Routes } from '@angular/router';
import { DashboardHome } from './features/dashboard/dashboard-home/dashboard-home';
import { MarketWatch } from './features/market-watch/market-watch';

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
    }
];
