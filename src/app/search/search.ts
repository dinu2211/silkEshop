import { Component } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field'; 
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatBadgeModule } from '@angular/material/badge';
import { Cart } from '../cart/cart';

@Component({
  selector: 'app-search',
  imports: [MatFormFieldModule,MatSelect,MatOption,MatIcon,MatInputModule,MatBadgeModule],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search {
  constructor(readonly cart: Cart) {}
}
