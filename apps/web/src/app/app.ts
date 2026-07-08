import { Component, signal } from '@angular/core';
import { Shell } from './layout/shell/shell';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Shell],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  protected readonly title = signal('web');
}
