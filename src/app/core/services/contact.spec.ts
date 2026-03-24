import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ContactService } from './contact';
import { environment } from '../../../environments/environment';

describe('ContactService', () => {
  let service: ContactService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(ContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should send contact request', () => {
    const payload = {
      name: 'Xavier',
      email: 'test@test.com',
      subject: 'Test',
      message: 'Message test valide'
    };

    service.send(payload).subscribe();

    const req = httpMock.expectOne(
      `${environment.api.baseUrl}${environment.api.contact}`
    );

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({});
  });
});
