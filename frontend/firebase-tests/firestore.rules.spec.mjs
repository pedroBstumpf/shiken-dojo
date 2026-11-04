import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const HEAD = 'sensei@dojo.test';
const INSTRUCTOR = 'instrutor@dojo.test';
const INACTIVE = 'inativo@dojo.test';
const STRANGER = 'estranho@dojo.test';

let env;

const teacher = (overrides = {}) => ({
  fullName: 'Professor Teste',
  email: INSTRUCTOR,
  phone: '',
  role: 'instructor',
  belt: 'preta',
  dan: 1,
  federationId: '',
  active: true,
  invitationPending: false,
  ...overrides,
});

const student = (overrides = {}) => ({
  fullName: 'Ana Souza',
  belt: 'branca',
  birthDate: null,
  ...overrides,
});

const exam = (overrides = {}) => ({
  status: 'draft',
  templateId: 'tpl',
  templateName: 'Exame',
  fromBelt: 'branca',
  toBelt: 'laranja',
  sections: [],
  date: '2026-06-20',
  location: '',
  examinerId: HEAD,
  examinerName: 'Sensei',
  passingGrade: 2,
  notes: '',
  participants: [],
  grades: {},
  completedAt: null,
  ...overrides,
});

/** Banco visto por um usuário logado; `verified` diz se ele comprovou o e-mail. */
const as = (email, verified = true) =>
  env.authenticatedContext(email, { email, email_verified: verified }).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
const teacherDoc = (db, email) => doc(db, 'teachers', email);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-shiken-dojo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(teacherDoc(db, HEAD), teacher({ email: HEAD, role: 'head_instructor' }));
    await setDoc(teacherDoc(db, INSTRUCTOR), teacher());
    await setDoc(teacherDoc(db, INACTIVE), teacher({ email: INACTIVE, active: false }));
    await setDoc(doc(db, 'students', 's1'), student());
    await setDoc(doc(db, 'exams', 'draft'), exam());
    await setDoc(
      doc(db, 'exams', 'done'),
      exam({ status: 'completed', completedAt: Timestamp.now() }),
    );
  });
});

describe('quem não é professor não vê nada', () => {
  for (const [path, id] of [
    ['students', 's1'],
    ['exams', 'done'],
    ['teachers', HEAD],
  ]) {
    it(`sem login não lê ${path}`, () => assertFails(getDoc(doc(anonymous(), path, id))));
    it(`com conta sem cadastro não lê ${path}`, () =>
      assertFails(getDoc(doc(as(STRANGER), path, id))));
    it(`inativo não lê ${path}`, () => assertFails(getDoc(doc(as(INACTIVE), path, id))));
  }

  it('e-mail não comprovado não acessa, mesmo igual ao de um professor', async () => {
    const db = as(INSTRUCTOR, false);
    await assertFails(getDoc(doc(db, 'students', 's1')));
    await assertFails(getDoc(teacherDoc(db, INSTRUCTOR)));
  });

  it('e-mail em outra caixa é o mesmo professor', () =>
    assertSucceeds(getDoc(doc(as(HEAD.toUpperCase()), 'students', 's1'))));

  it('estranho não se cadastra como professor', () =>
    assertFails(
      setDoc(
        teacherDoc(as(STRANGER), STRANGER),
        teacher({ email: STRANGER, invitationPending: true }),
      ),
    ));

  it('inativo lê o próprio cadastro, para o app explicar o motivo', () =>
    assertSucceeds(getDoc(teacherDoc(as(INACTIVE), INACTIVE))));
});

describe('convites', () => {
  const invited = 'novo@dojo.test';
  const invitation = (overrides = {}) =>
    teacher({ email: invited, invitationPending: true, ...overrides });

  it('instrutor convida instrutor', () =>
    assertSucceeds(setDoc(teacherDoc(as(INSTRUCTOR), invited), invitation())));

  it('instrutor não cria sensei responsável', () =>
    assertFails(
      setDoc(teacherDoc(as(INSTRUCTOR), invited), invitation({ role: 'head_instructor' })),
    ));

  it('sensei responsável cria outro sensei responsável', () =>
    assertSucceeds(setDoc(teacherDoc(as(HEAD), invited), invitation({ role: 'head_instructor' }))));

  it('o documento precisa ser do próprio e-mail', () =>
    assertFails(setDoc(teacherDoc(as(HEAD), invited), invitation({ email: 'outro@dojo.test' }))));

  it('e-mail com maiúsculas não vira cadastro separado', () =>
    assertFails(
      setDoc(teacherDoc(as(HEAD), 'Novo@dojo.test'), invitation({ email: 'Novo@dojo.test' })),
    ));

  it('convite já nasce pendente e ativo', async () => {
    const db = as(HEAD);
    await assertFails(setDoc(teacherDoc(db, invited), invitation({ invitationPending: false })));
    await assertFails(setDoc(teacherDoc(db, invited), invitation({ active: false })));
  });

  it('recusa dados inválidos e campos desconhecidos', async () => {
    const db = as(HEAD);
    await assertFails(setDoc(teacherDoc(db, invited), invitation({ fullName: 'X' })));
    await assertFails(setDoc(teacherDoc(db, invited), invitation({ belt: 'azul', dan: null })));
    await assertFails(setDoc(teacherDoc(db, invited), invitation({ belt: 'branca', dan: 3 })));
    await assertFails(setDoc(teacherDoc(db, invited), invitation({ admin: true })));
  });

  it('o próprio professor marca o convite como aceito, e nada além disso', async () => {
    await env.withSecurityRulesDisabled((context) =>
      setDoc(teacherDoc(context.firestore(), invited), invitation()),
    );
    const db = as(invited);
    await assertSucceeds(updateDoc(teacherDoc(db, invited), { invitationPending: false }));
    await assertFails(updateDoc(teacherDoc(db, invited), { role: 'head_instructor' }));
    await assertFails(updateDoc(teacherDoc(db, invited), { invitationPending: true }));
  });
});

describe('gestão de professores', () => {
  it('instrutor não edita nem exclui outro professor', async () => {
    const db = as(INSTRUCTOR);
    await assertFails(updateDoc(teacherDoc(db, HEAD), { fullName: 'Hackeado' }));
    await assertFails(deleteDoc(teacherDoc(db, HEAD)));
  });

  it('instrutor não se promove', () =>
    assertFails(updateDoc(teacherDoc(as(INSTRUCTOR), INSTRUCTOR), { role: 'head_instructor' })));

  it('sensei responsável edita, desativa e exclui outros', async () => {
    const db = as(HEAD);
    await assertSucceeds(updateDoc(teacherDoc(db, INSTRUCTOR), { fullName: 'Novo Nome' }));
    await assertSucceeds(updateDoc(teacherDoc(db, INSTRUCTOR), { active: false }));
    await assertSucceeds(deleteDoc(teacherDoc(db, INSTRUCTOR)));
  });

  it('o e-mail nunca muda', () =>
    assertFails(updateDoc(teacherDoc(as(HEAD), INSTRUCTOR), { email: 'outro@dojo.test' })));

  it('o dojo nunca fica sem responsável: ninguém se rebaixa, desativa ou exclui', async () => {
    const db = as(HEAD);
    await assertFails(updateDoc(teacherDoc(db, HEAD), { role: 'instructor' }));
    await assertFails(updateDoc(teacherDoc(db, HEAD), { active: false }));
    await assertFails(deleteDoc(teacherDoc(db, HEAD)));
    await assertSucceeds(updateDoc(teacherDoc(db, HEAD), { fullName: 'Nome Corrigido' }));
  });

  it('professor excluído perde o acesso na hora', async () => {
    await assertSucceeds(deleteDoc(teacherDoc(as(HEAD), INSTRUCTOR)));
    await assertFails(getDoc(doc(as(INSTRUCTOR), 'students', 's1')));
  });
});

describe('alunos', () => {
  it('qualquer professor cadastra, edita e exclui', async () => {
    const db = as(INSTRUCTOR);
    await assertSucceeds(setDoc(doc(db, 'students', 's2'), student()));
    await assertSucceeds(updateDoc(doc(db, 'students', 's2'), { belt: 'amarela' }));
    await assertSucceeds(deleteDoc(doc(db, 'students', 's2')));
  });

  it('só aceita nome, faixa e data de nascimento', async () => {
    const db = as(HEAD);
    await assertFails(setDoc(doc(db, 'students', 's2'), student({ cpf: '123' })));
    await assertFails(setDoc(doc(db, 'students', 's2'), student({ fullName: 'A' })));
    await assertFails(setDoc(doc(db, 'students', 's2'), student({ belt: 'azul' })));
    await assertFails(setDoc(doc(db, 'students', 's2'), student({ birthDate: 'ontem' })));
    await assertSucceeds(setDoc(doc(db, 'students', 's2'), student({ birthDate: '2014-03-12' })));
  });
});

describe('provas', () => {
  it('rascunho aceita notas e pode ser finalizado', async () => {
    const db = as(INSTRUCTOR);
    await assertSucceeds(updateDoc(doc(db, 'exams', 'draft'), { grades: { s1: { i1: 2.5 } } }));
    await assertSucceeds(
      updateDoc(doc(db, 'exams', 'draft'), { status: 'completed', completedAt: Timestamp.now() }),
    );
  });

  it('finalizar exige a data de finalização', () =>
    assertFails(updateDoc(doc(as(HEAD), 'exams', 'draft'), { status: 'completed' })));

  it('prova finalizada é imutável, até para o sensei responsável', async () => {
    const db = as(HEAD);
    await assertFails(updateDoc(doc(db, 'exams', 'done'), { grades: { s1: { i1: 0 } } }));
    await assertFails(updateDoc(doc(db, 'exams', 'done'), { status: 'draft', completedAt: null }));
    await assertFails(deleteDoc(doc(db, 'exams', 'done')));
  });

  it('rascunho pode ser excluído', () =>
    assertSucceeds(deleteDoc(doc(as(INSTRUCTOR), 'exams', 'draft'))));

  it('rascunho não troca alunos, examinador nem tabela', async () => {
    const db = as(HEAD);
    await assertFails(updateDoc(doc(db, 'exams', 'draft'), { participants: [{ x: 1 }] }));
    await assertFails(updateDoc(doc(db, 'exams', 'draft'), { examinerName: 'Outro' }));
    await assertFails(updateDoc(doc(db, 'exams', 'draft'), { passingGrade: 0 }));
  });

  it('prova importada pode chegar já finalizada', () =>
    assertSucceeds(
      setDoc(
        doc(as(HEAD), 'exams', 'imported'),
        exam({ status: 'completed', completedAt: Timestamp.now() }),
      ),
    ));

  it('recusa nota mínima fora da escala e situação incoerente', async () => {
    const db = as(HEAD);
    await assertFails(setDoc(doc(db, 'exams', 'x'), exam({ passingGrade: 4 })));
    await assertFails(setDoc(doc(db, 'exams', 'x'), exam({ status: 'completed' })));
    await assertFails(setDoc(doc(db, 'exams', 'x'), exam({ completedAt: Timestamp.now() })));
  });
});

describe('registro de PDFs', () => {
  const hash = 'a'.repeat(64);
  const entry = (overrides = {}) => ({
    examId: 'draft',
    variant: 'filled',
    createdBy: INSTRUCTOR,
    ...overrides,
  });

  it('professor registra e consulta', async () => {
    const db = as(INSTRUCTOR);
    await assertSucceeds(setDoc(doc(db, 'pdfExports', hash), entry()));
    await assertSucceeds(getDoc(doc(db, 'pdfExports', hash)));
  });

  it('quem não é professor não registra nem consulta', async () => {
    await assertFails(
      setDoc(doc(as(STRANGER), 'pdfExports', hash), entry({ createdBy: STRANGER })),
    );
    await assertFails(getDoc(doc(as(STRANGER), 'pdfExports', hash)));
  });

  it('registro não pode ser alterado, apagado nem assinado por outra pessoa', async () => {
    const db = as(INSTRUCTOR);
    await assertFails(setDoc(doc(db, 'pdfExports', hash), entry({ createdBy: HEAD })));
    await assertSucceeds(setDoc(doc(db, 'pdfExports', hash), entry()));
    await assertFails(updateDoc(doc(db, 'pdfExports', hash), { variant: 'blank' }));
    await assertFails(deleteDoc(doc(db, 'pdfExports', hash)));
  });

  it('o identificador precisa ser um hash', () =>
    assertFails(setDoc(doc(as(HEAD), 'pdfExports', 'qualquer'), entry({ createdBy: HEAD }))));
});

describe('o que não está nas regras é proibido', () => {
  it('coleção desconhecida é recusada', async () => {
    const db = as(HEAD);
    await assertFails(setDoc(doc(db, 'segredos', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(db, 'segredos', 'x')));
  });
});
