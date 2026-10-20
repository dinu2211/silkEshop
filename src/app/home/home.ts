import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card'; 
import { Search } from '../search/search';
import { CommonModule } from '@angular/common';
import { Cart, CartProduct } from '../cart/cart';

@Component({
  selector: 'app-home',
  imports: [MatCardModule, Search,CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  constructor(private readonly cart: Cart) {}

  readonly product: CartProduct = {
    id: 'apple-air-pods',
    name: 'Apple Air Pods',
    description: 'Bluetooth headphones',
    price: 99.99,
  };

  categories: string[] = [
    'Games',
    'Headphones',
    'Playstation',
    'Computer',
    'Fashion',
  ];

  addToCart(): void {
    this.cart.add(this.product);
  }
}
