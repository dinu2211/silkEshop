import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatBadge } from '@angular/material/badge';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatNavList } from '@angular/material/list';
import { MatMenu, MatMenuTrigger } from '@angular/material/menu';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { CartService } from '../cart-service';
import { ViewCart } from '../view-cart/view-cart';

@Component({
  selector: 'app-header',
  imports: [MatSidenavContainer,MatSidenav,AsyncPipe,MatToolbar,MatNavList,MatSidenavContent,MatIcon
    ,MatMenu,MatMenuTrigger,CommonModule,MatBadge,MatButton,ViewCart
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header implements OnInit {
  isHandset$!: Observable<boolean>;
  cartService = inject(CartService);
  isCartOpen = false;
  electronicsDevices:any;
  mobiles: string[] = [];
  accessories: string[] = [];
  fashion: string[] = [];
  laptops: string[] = [];
  games: string[] = [];
  watches: string[] = [];
  mobileAccessories: string[] = [];
  audios: string[] = [];
  smartDevices: string[] = [];

  constructor(private breakpointObserver: BreakpointObserver) {}

  productsCategory = [
    {
      categoryName: 'ElectronicsDevices',
      children: [
        {
          type: 'Mobile & Tablets',
          children: ['Mobiles', 'Landlines', 'Tablets'],
        },
        {
          type: 'Laptop',
          children: ['Traditional Laptops', 'Gaming Laptops'],
        },
        {
          type: 'Console Gaming',
          children: ['Console', 'Console Game', 'Console Game Accessories'],
        },
        {
          type: 'Smart watches & Accessories',
          children: ['Fitness Trackers', 'Smart Trackers'],
        },
      ],
    },
    {
      categoryName: 'Electronics Acessories',
      children: [
        {
          type: 'Mobile Accesories',
          children: ['Phone Cases', 'Power Banks', 'Cables & Converters'],
        },
        {
          type: 'Audios',
          children: [
            'Head Phones & Head Sets',
            'Portable Speakers',
            'Home Audio',
          ],
        },
        {
          type: 'Smart Devices',
          children: [
            'Electronic Cigarrets',
            'Smart Speakers',
            'Virtual Reality',
          ],
        },
      ],
    },
    {
      categoryName: "Men's' Fashion",
      children: [
        {
          type: 'Men Clothing',
          children: ['Tshirt & Tanks', 'Shirts', 'Pants'],
        },
        {
          type: 'Men Shoes',
          children: ['Shoes', 'Boots', 'Flip Flops'],
        },
        {
          type: 'Accessories',
          children: ['Socks', 'Belts', 'Hat & Caps'],
        },
      ],
    },
  ];

  ngOnInit(): void {
    this.isHandset$ = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay()
    );

    this.getProducts();
  }

  getProducts() {
    const products: any[] = [];
    this.productsCategory.map((product) => {
      products.push(product);
      console.log(product);
      const electronics = products[0].children.length;
      this.mobiles = products[0].children[0].children;
      this.laptops = products[0].children[electronics - 3].children;
      this.games = products[0].children[electronics - 2].children;
      this.watches = products[0].children[electronics - 1].children;

      return products;
    });
  }
}
