import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-condition',
  imports: [RouterLink],
  templateUrl: './terms-condition.html',
  styleUrl: './terms-condition.scss',
})
export class TermsCondition {
  @Input() embedded = false;
}
