import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpTesting.expectOne('/api/products').flush([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the PNG brand icon', () => {
    const icon = fixture.nativeElement.querySelector('.logo-mark') as HTMLImageElement;

    expect(icon.getAttribute('src')).toBe('/favicon.png');
  });

  afterEach(() => {
    httpTesting.verify();
  });
});
