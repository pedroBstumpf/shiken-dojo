import { Injectable } from '@angular/core';
import { ExamDto, ExamTemplateDto } from '@shared/data-access/exams/exam.dto';
import { StudentDto } from '@shared/data-access/students/student.dto';
import { createSeedExam, createSeedStudents, SEED_TEMPLATES } from './mock-seed';

export interface MockDbState {
  readonly version: 1;
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
        if (parsed.version === 1) {
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
    const students = createSeedStudents(now);
    return {
      version: 1,
      students,
      templates: [...SEED_TEMPLATES],
      exams: [createSeedExam(students, now)],
    };
  }
}
