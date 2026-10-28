import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { formatDan, Teacher, TEACHER_ROLE_INFO } from '@shared/data-access/teachers/teacher.model';
import { BeltBadgeComponent } from '@shared/ui/belt-badge.component';
import { InitialsAvatarComponent } from '@shared/ui/initials-avatar.component';
import { formatPhone } from '@shared/utils/phone.utils';

@Component({
  selector: 'sd-teacher-card',
  imports: [
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
    '[class.opacity-70]': '!teacher().active',
  },
  template: `
    <sd-initials-avatar [name]="teacher().fullName" [size]="48" />
    <div class="min-w-0 flex-1">
      @if (canManage()) {
        <!-- O link cobre o card inteiro (after:absolute), sem aninhar o botão de menu dentro dele. -->
        <a
          [routerLink]="['/teachers', teacher().id, 'edit']"
          class="block truncate font-semibold text-on-surface after:absolute after:inset-0 after:rounded-2xl focus:outline-none"
          >{{ teacher().fullName }}</a
        >
      } @else {
        <p class="truncate font-semibold text-on-surface">{{ teacher().fullName }}</p>
      }
      <p class="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span
          class="rounded-full px-2 py-0.5 text-xs font-semibold"
          [class.bg-primary-container]="teacher().role === 'head_instructor'"
          [class.text-on-primary-container]="teacher().role === 'head_instructor'"
          [class.bg-surface-container]="teacher().role !== 'head_instructor'"
          >{{ roleLabel() }}</span
        >
        @if (!teacher().active) {
          <span class="rounded-full border border-outline px-2 py-0.5 text-xs">Inativo</span>
        } @else if (teacher().invitationPending) {
          <span
            class="rounded-full bg-tertiary-container px-2 py-0.5 text-xs text-on-tertiary-container"
            >Convite pendente</span
          >
        }
      </p>
      <p class="mt-2 flex items-center gap-2 text-sm">
        <sd-belt-badge [belt]="teacher().belt" />
        @if (danLabel()) {
          <span class="font-semibold">{{ danLabel() }}</span>
        }
      </p>
      <dl class="mt-2 space-y-0.5 text-sm text-on-surface-variant">
        <div class="flex items-center gap-1.5">
          <dt>
            <mat-icon class="sd-icon-sm" aria-hidden="true">mail</mat-icon
            ><span class="sr-only">E-mail</span>
          </dt>
          <dd class="truncate">{{ teacher().email }}</dd>
        </div>
        @if (phoneLabel()) {
          <div class="flex items-center gap-1.5">
            <dt>
              <mat-icon class="sd-icon-sm" aria-hidden="true">call</mat-icon
              ><span class="sr-only">Telefone</span>
            </dt>
            <dd>{{ phoneLabel() }}</dd>
          </div>
        }
        @if (teacher().federationId) {
          <div class="flex items-center gap-1.5">
            <dt>
              <mat-icon class="sd-icon-sm" aria-hidden="true">id_card</mat-icon
              ><span class="sr-only">Registro</span>
            </dt>
            <dd>Registro {{ teacher().federationId }}</dd>
          </div>
        }
      </dl>
    </div>
    @if (canManage()) {
      <button
        matIconButton
        type="button"
        class="relative z-10 -mt-1 -mr-2"
        [matMenuTriggerFor]="menu"
        [attr.aria-label]="'Ações para ' + teacher().fullName"
      >
        <mat-icon aria-hidden="true">more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu" xPosition="before">
        <a mat-menu-item [routerLink]="['/teachers', teacher().id, 'edit']">
          <mat-icon aria-hidden="true">edit</mat-icon>
          Editar
        </a>
        @if (teacher().active && teacher().invitationPending) {
          <button mat-menu-item type="button" (click)="invitationResent.emit(teacher())">
            <mat-icon aria-hidden="true">forward_to_inbox</mat-icon>
            Reenviar convite
          </button>
        }
        <button mat-menu-item type="button" (click)="removed.emit(teacher())">
          <mat-icon aria-hidden="true">delete</mat-icon>
          Excluir
        </button>
      </mat-menu>
    }
  `,
})
export class TeacherCardComponent {
  readonly teacher = input.required<Teacher>();
  /** Só o sensei responsável edita, exclui e reenvia convites. */
  readonly canManage = input(false);

  readonly removed = output<Teacher>();
  readonly invitationResent = output<Teacher>();

  protected readonly roleLabel = computed(() => TEACHER_ROLE_INFO[this.teacher().role].label);
  protected readonly danLabel = computed(() => formatDan(this.teacher().dan));
  protected readonly phoneLabel = computed(() =>
    this.teacher().phone ? formatPhone(this.teacher().phone) : '',
  );
}
