import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Paginated } from '@shared/models/paginated.model';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base-url.token';
import { TeacherDto } from './teacher.dto';
import { toTeacher, toTeacherWriteDto } from './teacher.mapper';
import { Teacher, TeacherInput } from './teacher.model';

const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class TeacherApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/teachers`;

  list(): Observable<readonly Teacher[]> {
    const params = new HttpParams().set('limit', PAGE_LIMIT);
    return this.http
      .get<Paginated<TeacherDto>>(this.url, { params })
      .pipe(map((page) => page.items.map(toTeacher)));
  }

  get(id: string): Observable<Teacher> {
    return this.http.get<TeacherDto>(this.teacherUrl(id)).pipe(map(toTeacher));
  }

  create(input: TeacherInput): Observable<Teacher> {
    return this.http.post<TeacherDto>(this.url, toTeacherWriteDto(input)).pipe(map(toTeacher));
  }

  update(id: string, input: TeacherInput): Observable<Teacher> {
    return this.http
      .put<TeacherDto>(this.teacherUrl(id), toTeacherWriteDto(input))
      .pipe(map(toTeacher));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(this.teacherUrl(id));
  }

  private teacherUrl(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}
