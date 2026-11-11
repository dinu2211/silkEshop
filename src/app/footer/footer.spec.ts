import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([]), provideZonelessChangeDetection()],
    })
      .compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the PNG brand icon', () => {
    const icon = fixture.nativeElement.querySelector('.brand-mark') as HTMLImageElement;

    expect(icon.getAttribute('src')).toBe('/favicon.png');
  });

  it('should render the footer navigation', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;
    const footer = nativeElement.querySelector('footer');
    const links = nativeElement.querySelectorAll<HTMLAnchorElement>('.footer-navigation a');

    expect(footer).toBeTruthy();
    expect(links.length).toBe(7);
    expect(links[0].textContent?.trim()).toBe('Home');
    expect(links[1].textContent?.trim()).toBe('About');
    expect(links[2].textContent?.trim()).toBe('Premium');
    expect(links[2].getAttribute('href')).toBe('/premium-collection');
  });

  it('should render all footer navigation destinations', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;
    const links = nativeElement.querySelectorAll<HTMLAnchorElement>(
      '.footer-navigation a',
    );

    expect(Array.from(links).map(link => link.textContent?.trim())).toEqual([
      'Home',
      'About',
      'Premium',
      'Track order',
      'Contact',
      'Return Policy',
      'Terms & Conditions',
    ]);
    expect(Array.from(links).map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/about',
      '/premium-collection',
      '/track',
      '/contact',
      '/terms-condition#return-policy-title',
      '/terms-condition#terms-title',
    ]);
  });
});
