import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LaunchingSoon } from './launching-soon';

describe('LaunchingSoon', () => {
  let component: LaunchingSoon;
  let fixture: ComponentFixture<LaunchingSoon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LaunchingSoon]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LaunchingSoon);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the launch announcement', () => {
    const heading = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;
    expect(heading.textContent).toContain('A timeless tradition is coming');
    expect(fixture.nativeElement.textContent).toContain('Weave Made');
    expect(fixture.nativeElement.textContent).toContain('Threads of Tradition');
  });
});
