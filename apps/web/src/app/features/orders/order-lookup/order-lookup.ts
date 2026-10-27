
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-order-lookup',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './order-lookup.html',
  styleUrl: './order-lookup.scss',
})
export class OrderLookup {
  private readonly apiService = inject(ApiService);

  readonly orderId = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly orderDetails = signal<unknown | null>(null);

  lookupOrder(event: Event): void {
    event.preventDefault();

    const id = this.orderId().trim();

    if (!id || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.orderDetails.set(null);

    this.apiService.getOrderDetails(id).subscribe({
      next: (response) => {
        this.orderDetails.set(response);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(
          error.status === 404
            ? 'Order endpoint or order was not found.'
            : 'Unable to retrieve order details. Please check the order ID and API connection.',
        );
        this.loading.set(false);
      },
    });
  }
}
