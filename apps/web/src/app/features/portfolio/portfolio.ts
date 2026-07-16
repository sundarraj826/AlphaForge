import { Component, inject } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { PortfolioService } from '../../core/services/portfolio';
import { CurrencyPipe, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-portfolio',
  imports: [MatTableModule, CurrencyPipe, DecimalPipe],
  templateUrl: './portfolio.html',
  styleUrl: './portfolio.scss',
})
export class Portfolio {

  readonly portfolioService = inject(PortfolioService);
  readonly portfolioItems = this.portfolioService.portfolioItems;


  displayedColumns: string[] = ['instrument', 'quantity', 'averageEntry', 'marketPrice', 'invested', 'currentValue', 'pl', 'plPercentage'];
}
