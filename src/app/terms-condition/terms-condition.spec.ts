import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { TermsCondition } from './terms-condition';

describe('TermsCondition', () => {
  let component: TermsCondition;
  let fixture: ComponentFixture<TermsCondition>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsCondition],
      providers: [provideRouter([]), provideZonelessChangeDetection()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TermsCondition);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the return policy, terms, privacy policy, and support details', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Return & Exchange Policy');
    expect(element.querySelector('#terms-title')?.textContent?.trim()).toBe('Terms and Conditions');
    expect(
      Array.from(element.querySelectorAll('.terms-sections > .terms-section h2'))
        .map(heading => heading.textContent?.trim()),
    ).toEqual([
        'Online store terms',
        'Products and pricing',
        'Returns and refunds',
        'Limitation of liability',
        'Governing law',
      ]);
    expect(
      Array.from(element.querySelectorAll('.return-policy-section h2'))
        .map(heading => heading.textContent?.trim()),
    ).toEqual([
      'Return & exchange window',
      'Eligibility for returns & exchanges',
      'Non-returnable / final sale items',
      'Damaged, defective, or wrong items',
      'Complimentary return shipping & courier charges',
      'Refunds & processing time',
      'How to start a return',
    ]);
    expect(element.querySelector('#privacy-policy-title')?.textContent?.trim()).toBe('Privacy Policy');
    expect(element.querySelector('#support-title')?.textContent?.trim()).toBe('Contact and Support');
    expect(Array.from(element.querySelectorAll('.privacy-policy h3')).map(heading => heading.textContent?.trim()))
      .toEqual([
        'Information we collect',
        'How we use your information',
        'Data protection and security',
        'Third-party disclosures',
        'Your rights and consent',
      ]);
    expect(element.querySelector('a[href="https://weavemade.in/return"]')).toBeTruthy();
    const whatsappLinks = element.querySelectorAll<HTMLAnchorElement>(
      'a[href="https://wa.me/917418758951"]',
    );
    expect(whatsappLinks.length).toBe(4);
    expect(element.querySelector('.return-contact')?.textContent).toContain('7418758951');
    expect(element.querySelector('a[routerLink="/contact"]')).toBeTruthy();
  });
});
