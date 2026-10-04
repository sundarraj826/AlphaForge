import { Component, inject, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MarketService } from '../../core/services/market';
import { DecimalPipe, CurrencyPipe } from '@angular/common';

import { MarketHistoryService } from '../../core/services/market-history';
import { IndicatorService } from '../../core/services/indicators';


@Component({
  selector: 'app-market-watch',
  standalone: true,
  imports: [MatTableModule, DecimalPipe, CurrencyPipe],
  templateUrl: './market-watch.html',
  styleUrl: './market-watch.scss',
})
export class MarketWatch implements OnInit {
  readonly marketService = inject(MarketService);

  // readonly marketHistoryService = inject(MarketHistoryService);
  // readonly indicatorService = inject(IndicatorService);

  readonly marketInstruments = this.marketService.marketInstruments;

  displayedColumns: string[] = [
    'symbol',
    'price',
    'change',
    'changePercent',
    'volume'
  ];

  ngOnInit(): void {



  }
}