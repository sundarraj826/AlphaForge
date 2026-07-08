import { Component, inject, Pipe } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MarketService } from '../../core/services/market';
import { DecimalPipe, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-market-watch',
  standalone: true,
  imports: [MatTableModule, DecimalPipe, CurrencyPipe],
  templateUrl: './market-watch.html',
  styleUrl: './market-watch.scss',
})
export class MarketWatch {
  readonly marketService = inject(MarketService);

  readonly marketInstruments = this.marketService.marketInstruments;

  displayedColumns: string[] = ['symbol', 'price', 'change', 'changePercent', 'volume'];
}
