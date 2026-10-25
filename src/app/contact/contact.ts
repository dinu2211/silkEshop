import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  imports: [],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  readonly images = [
    {
      src: 'assets/images/about/images.jpg',
      alt: 'Textile work and community services',
    },
    {
      src: 'assets/images/about/Electric-Dhoti-Making-Machine.jpg',
      alt: 'Electric dhoti-making machine',
    },
    {
      src: 'assets/images/about/images%20(1).jpg',
      alt: 'Textile production',
    },
    {
      src: 'assets/images/about/9870_19_4_2025_13_11_35_1_ER20POWERLOOM1.jpg',
      alt: 'Power loom in operation',
    },
  ];
}
