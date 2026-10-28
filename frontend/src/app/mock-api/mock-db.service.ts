import { Injectable } from '@angular/core';
import { ExamDto, ExamTemplateDto } from '@shared/data-access/exams/exam.dto';
import { StudentDto } from '@shared/data-access/students/student.dto';
import { TeacherDto } from '@shared/data-access/teachers/teacher.dto';
import {
  createSeedExam,
  createSeedStudents,
  createSeedTeachers,
  SEED_TEMPLATES,
} from './mock-seed';

/** Aumente quando o formato mudar: dados antigos no navegador são descartados e recriados. */
const DB_VERSION = 2;

export interface MockDbState {
  readonly version: typeof DB_VERSION;
  teachers: TeacherDto[];
  students: StudentDto[];
  templates: ExamTemplateDto[];
  exams: ExamDto[];
}

const STORAGE_KEY = 'sd-mock-db';

/**
 * "Banco de dados" da API simulada, persistido no localStorage do navegador.
 * APENAS PARA DESENVOLVIMENTO: dados de alunos não devem ficar no navegador em produção.
 * Será removido quando o back-end (PostgreSQL) estiver disponível.
 */
@Injectable({ providedIn: 'root' })
export class MockDbService {
  private state = this.load();

  read(): Readonly<MockDbState> {
    return this.state;
  }

  write(mutate: (state: MockDbState) => void): void {
    mutate(this.state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Sem storage (aba anônima, cota cheia): os dados ficam só em memória.
    }
  }

  private load(): MockDbState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as MockDbState;
        if (parsed.version === DB_VERSION) {
          return parsed;
        }
      }
    } catch {
      // Storage indisponível ou corrompido: recomeça com os dados de exemplo.
    }
    return this.seed();
  }

  private seed(): MockDbState {
    const now = new Date().toISOString();
    const teachers = createSeedTeachers(now);
    const students = createSeedStudents(now);
    return {
      version: DB_VERSION,
      teachers,
      students,
      templates: [...SEED_TEMPLATES],
      exams: [createSeedExam(students, teachers[0]!, now)],
    };
  }
}
