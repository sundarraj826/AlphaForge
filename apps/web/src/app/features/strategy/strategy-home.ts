import { Component, inject } from '@angular/core';
import { StrategyService } from '../../core/services/strategy';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-strategy-home',
  imports: [MatTableModule, RouterLink, MatButton],
  templateUrl: './strategy-home.html',
  styleUrl: './strategy-home.scss',
})
export class StrategyHome {

  private readonly _strategyService = inject(StrategyService);
  readonly strategies = this._strategyService.strategies;

  displayedColumns: string[] = ['name', 'instrument', 'timeframe', 'status'];
}
