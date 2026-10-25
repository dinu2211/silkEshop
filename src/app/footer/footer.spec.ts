import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    })
      .compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the footer navigation', () => {
    const footer = fixture.nativeElement.querySelector('footer');
    const links = fixture.nativeElement.querySelectorAll<HTMLAnchorElement>('.footer-navigation a');

    expect(footer).toBeTruthy();
    expect(links.length).toBe(2);
    expect(links[0].textContent?.trim()).toBe('Home');
    expect(links[1].textContent?.trim()).toBe('Contact');
  });

  it('should render mobile navigation links for home, about, and contact', () => {
    const links = fixture.nativeElement.querySelectorAll<HTMLAnchorElement>(
      '.footer-mobile-navigation a',
    );

    expect(Array.from(links).map(link => link.textContent?.trim())).toEqual([
      'Home',
      'About',
      'Contact',
    ]);
    expect(Array.from(links).map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/about',
      '/contact',
    ]);
  });
});
