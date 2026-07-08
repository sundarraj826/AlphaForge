import { Component, input } from '@angular/core';

@Component({
  selector: 'app-summary-card',
  standalone: true,
  imports: [],
  templateUrl: './summary-card.html',
  styleUrl: './summary-card.scss',
})
export class SummaryCard {
  title = input.required<string>();
  value = input.required<string>();
}