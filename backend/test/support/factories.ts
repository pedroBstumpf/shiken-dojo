import { randomUUID } from 'node:crypto';
import type { Queryable } from '../../src/infra/db/pool.js';
import { hashPassword } from '../../src/modules/auth/password.js';

// Dados fictícios criados pelo próprio teste: cada teste tem seu dojo e seus e-mails.

export const TEST_PASSWORD = 'senha-de-teste-123';
let cachedHash: Promise<string> | undefined;

export async function createDojo(db: Queryable, name = 'Dojo de teste'): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO dojos (name) VALUES ($1) RETURNING id',
    [name],
  );
  return rows[0]!.id;
}

export interface TestTeacher {
  readonly id: string;
  readonly dojoId: string;
  readonly email: string;
}

export async function createTeacher(
  db: Queryable,
  dojoId: string,
  overrides: {
    readonly role?: 'head_instructor' | 'instructor';
    readonly active?: boolean;
    readonly withPassword?: boolean;
    readonly fullName?: string;
  } = {},
): Promise<TestTeacher> {
  const email = `sensei-${randomUUID()}@dojo.test`;
  cachedHash ??= hashPassword(TEST_PASSWORD);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO teachers (dojo_id, full_name, email, role, belt, dan, active, password_hash)
     VALUES ($1, $2, $3, $4, 'preta', 1, $5, $6)
     RETURNING id`,
    [
      dojoId,
      overrides.fullName ?? 'Sensei de Teste',
      email,
      overrides.role ?? 'head_instructor',
      overrides.active ?? true,
      overrides.withPassword === false ? null : await cachedHash,
    ],
  );
  return { id: rows[0]!.id, dojoId, email };
}
