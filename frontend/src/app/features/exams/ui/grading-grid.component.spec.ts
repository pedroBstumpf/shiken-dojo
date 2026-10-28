import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExamParticipant, ExamSection, GradeSheet } from '@shared/data-access/exams/exam.model';
import { GradeChange, GradingGridComponent } from './grading-grid.component';

const sections: ExamSection[] = [
  {
    id: 'k1',
    title: 'Kihon',
    kanji: '基本',
    showTotal: true,
    items: [
      { id: 'i1', label: 'Maegueri/zenkutso' },
      { id: 'i2', label: 'Mawashi-Gueri' },
    ],
  },
];

const participants: ExamParticipant[] = [
  { studentId: 's1', fullName: 'Ana Beatriz Carvalho', belt: 'branca' },
  { studentId: 's2', fullName: 'Bruno Lima', belt: 'branca' },
];

describe('GradingGridComponent', () => {
  let fixture: ComponentFixture<GradingGridComponent>;
  let element: HTMLElement;
  let changes: GradeChange[];

  beforeAll(() => {
    // jsdom não implementa scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
  });

  async function setup(grades: GradeSheet = {}): Promise<void> {
    fixture = TestBed.createComponent(GradingGridComponent);
    fixture.componentRef.setInput('sections', sections);
    fixture.componentRef.setInput('participants', participants);
    fixture.componentRef.setInput('grades', grades);
    fixture.componentRef.setInput('passingGrade', 6);
    fixture.componentRef.setInput('editable', true);
    changes = [];
    fixture.componentInstance.gradeChange.subscribe((change) => changes.push(change));
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  function cell(row: number, col: number): HTMLInputElement {
    return element.querySelector<HTMLInputElement>(`input[data-cell="${row}:${col}"]`)!;
  }

  async function focus(input: HTMLInputElement): Promise<void> {
    input.focus();
    await fixture.whenStable();
  }

  it('destaca a linha da técnica e a coluna do aluno da célula ativa', async () => {
    await setup();
    await focus(cell(1, 1));

    const activeRow = element.querySelector('tr.is-active-row')!;
    expect(activeRow.querySelector('th')?.textContent).toContain('Mawashi-Gueri');
    const activeHead = element.querySelector('thead th.is-active-col')!;
    expect(activeHead.textContent).toContain('Bruno Lima');
    // Faixa acima da tabela diz quem e o quê está sendo avaliado.
    expect(element.textContent).toContain('Mawashi-Gueri');
  });

  it('emite a nota ao sair da célula e avança para o próximo aluno com Enter', async () => {
    await setup();
    const first = cell(0, 0);
    await focus(first);
    first.value = '7,5';
    // Enter move o foco; o blur da célula anterior grava a nota.
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(changes).toEqual([{ studentId: 's1', itemId: 'i1', value: 7.5 }]);
    expect(document.activeElement).toBe(cell(0, 1));
  });

  it('marca nota inválida sem emitir alteração', async () => {
    await setup();
    const input = cell(0, 0);
    await focus(input);
    input.value = '12';
    input.blur();
    await fixture.whenStable();

    expect(changes).toEqual([]);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('calcula totais, média e resultado de cada aluno', async () => {
    await setup({ s1: { i1: 8, i2: 7 }, s2: { i1: 5 } });
    const text = element.querySelector('tfoot')!.textContent!;
    expect(text).toContain('7,5');
    expect(text).toContain('Aprovado');
    expect(text).toContain('Pendente');
    expect(element.querySelector('.total-row')!.textContent).toContain('15,0');
  });

  it('leva o foco à primeira nota em branco', async () => {
    await setup({ s1: { i1: 8, i2: 7 }, s2: { i1: 5 } });
    expect(fixture.componentInstance.focusFirstBlank()).toBe(true);
    expect(document.activeElement).toBe(cell(1, 1));
  });
});
