import { Component, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MarketService } from '../../core/services/market';

@Component({
  selector: 'app-market-watch',
  standalone: true,
  imports: [MatTableModule],
  templateUrl: './market-watch.html',
  styleUrl: './market-watch.scss',
})
export class MarketWatch {
  readonly marketService = inject(MarketService);

  readonly marketTicks = this.marketService.marketTicks;

  displayedColumns: string[] = ['symbol', 'price', 'change', 'changePercent', 'volume'];
}
