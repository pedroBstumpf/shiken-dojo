/**
 * Dados fictícios para desenvolvimento, só nos emuladores locais (`npm run emulators`).
 * Nunca use dados reais de alunos aqui.
 *
 *   npm run emulators:seed
 */
const PROJECT = 'demo-shiken-dojo';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
// "Bearer owner" é a credencial de administrador dos emuladores; não existe na nuvem.
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const PASSWORD = 'dojo-demo-1234';

const TEACHERS = [
  ['okada@dojo.exemplo', 'Hiroshi Okada', 'head_instructor'],
  ['mariana@dojo.exemplo', 'Mariana Costa', 'instructor'],
];

const STUDENTS = [
  ['Ana Beatriz Carvalho', 'branca', '2014-03-12'],
  ['Bruno Henrique Lima', 'branca', '2012-07-25'],
  ['Carla Mendes', 'branca', '2010-11-02'],
  ['Diego Fernandes Rocha', 'amarela', '2013-01-30'],
  ['Eduarda Nogueira', 'branca', '2015-06-18'],
  ['Felipe Augusto Martins', 'vermelha', '2009-09-09'],
  ['Gabriela Tanaka', 'laranja', '2011-04-21'],
  ['Mateus Oliveira', 'branca', null],
];

const text = (value) => (value === null ? { nullValue: null } : { stringValue: value });

async function request(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${init.method} ${url}: ${await response.text()}`);
  return response.json();
}

async function writeDoc(path, fields) {
  const now = { timestampValue: new Date().toISOString() };
  await request(`${FIRESTORE}/${path}`, {
    method: 'PATCH',
    headers: ADMIN,
    body: JSON.stringify({ fields: { ...fields, createdAt: now, updatedAt: now } }),
  });
}

for (const [email, fullName, role] of TEACHERS) {
  await request(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
    method: 'POST',
    headers: ADMIN,
    body: JSON.stringify({ email, password: PASSWORD, emailVerified: true }),
  });
  await writeDoc(`teachers/${email}`, {
    fullName: text(fullName),
    email: text(email),
    phone: text(''),
    role: text(role),
    belt: text('preta'),
    dan: { integerValue: role === 'head_instructor' ? '4' : '1' },
    federationId: text(''),
    active: { booleanValue: true },
    invitationPending: { booleanValue: false },
  });
}

for (const [index, [fullName, belt, birthDate]] of STUDENTS.entries()) {
  await writeDoc(`students/demo-${index + 1}`, {
    fullName: text(fullName),
    belt: text(belt),
    birthDate: text(birthDate),
  });
}

console.log('Dados de demonstração criados. Entre com:');
console.log(`  ${TEACHERS.map(([email]) => email).join(' ou ')}`);
console.log(`  senha: ${PASSWORD}`);
