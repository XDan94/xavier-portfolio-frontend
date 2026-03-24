import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {

  constructor(private http: HttpClient) {}

  send(payload: ContactPayload): Observable<void> {
    console.log('URL =>', `${environment.api.baseUrl}${environment.api.contact}`);
    return this.http.post<void>(
      `${environment.api.baseUrl}${environment.api.contact}`,
      payload
    );
  }
}
