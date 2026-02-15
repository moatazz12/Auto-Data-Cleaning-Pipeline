import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-terms-of-use',
  templateUrl: './terms-of-use.component.html',
  styleUrls: ['./terms-of-use.component.css']
})
export class TermsOfUseComponent {
  currentDate = new Date().toISOString().split('T')[0];

  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
