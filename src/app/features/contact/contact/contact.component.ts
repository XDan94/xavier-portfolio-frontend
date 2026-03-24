import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent implements OnInit {

  contactForm!: FormGroup;
  loading = false;
  success = false;
  error = false;
  submitted = false;

  constructor(private fb: FormBuilder, private http: HttpClient) {}

  ngOnInit(): void {
    this.contactForm = this.fb.group({
      name:    ['', Validators.required],
      email:   ['', [Validators.required, Validators.email]],
      subject: ['', Validators.required],
      message: ['', [Validators.required, Validators.minLength(10)]],
      consent: [false],
    });
  }

  get f() {
    return this.contactForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.contactForm.invalid) return;

    this.loading = true;
    this.success = false;
    this.error = false;

    this.http.post(`${environment.apiUrl}/contact`, {
      name:    this.f['name'].value,
      email:   this.f['email'].value,
      subject: this.f['subject'].value,
      message: this.f['message'].value,
    }).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        this.contactForm.reset();
        this.submitted = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      }
    });
  }
}
