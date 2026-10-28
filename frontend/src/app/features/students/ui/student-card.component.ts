import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { Student } from '@shared/data-access/students/student.model';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { InitialsAvatarComponent } from '@shared/ui/initials-avatar.component';
import { ageInYears } from '@shared/utils/date.utils';

@Component({
  selector: 'sd-student-card',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    BeltBadgeComponent,
    InitialsAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'bg-surface-lowest border-outline-variant hover:border-primary focus-within:border-primary relative flex items-start gap-4 rounded-2xl border p-4 transition-colors',
  },
  template: `
    <sd-initials-avatar [name]="student().fullName" [size]="48" />
    <div class="min-w-0 flex-1">
      <!-- O link cobre o card inteiro (after:absolute), sem aninhar o botão de menu dentro dele. -->
      <a
        [routerLink]="['/students', student().id, 'edit']"
        class="block truncate font-semibold text-on-surface after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
        >{{ student().fullName }}</a
      >
      <sd-belt-badge [belt]="student().belt" class="mt-1" />
      <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surface-variant">
        @if (age() !== null) {
          <div>
            <dt class="sr-only">Idade</dt>
            <dd>{{ age() }} anos</dd>
          </div>
        }
        @if (student().enrollmentDate; as enrollmentDate) {
          <div>
            <dt class="sr-only">Treina desde</dt>
            <dd>Treina desde {{ enrollmentDate | date: 'MMM/yyyy' }}</dd>
          </div>
        }
      </dl>
    </div>
    <button
      matIconButton
      type="button"
      class="relative z-10 -mt-1 -mr-2"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Ações para ' + student().fullName"
    >
      <mat-icon aria-hidden="true">more_vert</mat-icon>
    </button>
    <mat-menu #menu="matMenu" xPosition="before">
      <a mat-menu-item [routerLink]="['/students', student().id, 'edit']">
        <mat-icon aria-hidden="true">edit</mat-icon>
        Editar
      </a>
      <button mat-menu-item type="button" (click)="removed.emit(student())">
        <mat-icon aria-hidden="true">delete</mat-icon>
        Excluir
      </button>
    </mat-menu>
  `,
})
export class StudentCardComponent {
  readonly student = input.required<Student>();

  readonly removed = output<Student>();

  protected readonly age = computed(() => {
    const birthDate = this.student().birthDate;
    return birthDate ? ageInYears(birthDate) : null;
  });
}
