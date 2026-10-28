import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShellComponent } from '@core/layout/shell.component';

@Component({
  selector: 'sd-root',
  imports: [ShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<sd-shell />',
})
export class AppComponent {}
