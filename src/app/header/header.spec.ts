import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Header } from './header';
import { Supabase } from '../services/supabase';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
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
});
