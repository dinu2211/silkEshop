import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { Header } from './header';
import { Supabase } from '../services/supabase';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: Supabase,
          useValue: { getProducts: jasmine.createSpy('getProducts').and.resolveTo([]) },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the PNG brand icon', () => {
    const icon = fixture.nativeElement.querySelector('.logo-mark') as HTMLImageElement;

    expect(icon.getAttribute('src')).toBe('/favicon.png');
  });

  it('links to the premium collection', () => {
    const link = fixture.nativeElement.querySelector(
      'a[routerLink="/premium-collection"]',
    ) as HTMLAnchorElement;

    expect(link.textContent.trim()).toBe('Premium');
  });
});
