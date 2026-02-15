import { Component } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.css']
})
export class PrivacyPolicyComponent {
  currentDate = new Date().toISOString().split('T')[0];

  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
