import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Paginated } from '@shared/models/paginated.model';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url.token';
import { StudentDto } from './student.dto';
import { toStudent, toStudentWriteDto } from './student.mapper';
import { Student, StudentInput } from './student.model';

/** Máximo aceito pela API por página. Um dojo raramente passa disso. */
const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class StudentApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/students`;

  list(): Observable<readonly Student[]> {
    const params = new HttpParams().set('limit', PAGE_LIMIT);
    return this.http
      .get<Paginated<StudentDto>>(this.url, { params })
      .pipe(map((page) => page.items.map(toStudent)));
  }

  get(id: string): Observable<Student> {
    return this.http.get<StudentDto>(`${this.url}/${encodeURIComponent(id)}`).pipe(map(toStudent));
  }

  create(input: StudentInput): Observable<Student> {
    return this.http.post<StudentDto>(this.url, toStudentWriteDto(input)).pipe(map(toStudent));
  }

  update(id: string, input: StudentInput): Observable<Student> {
    return this.http
      .put<StudentDto>(`${this.url}/${encodeURIComponent(id)}`, toStudentWriteDto(input))
      .pipe(map(toStudent));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
