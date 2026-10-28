import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireAuth } from './modules/auth/auth.guard.js';
import type { AuthService } from './modules/auth/auth.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { examEmailRoutes, type ExamEmailService } from './modules/exams/exam-email.js';
import { examTemplateRoutes, type ExamTemplatesService } from './modules/exams/exam-templates.js';
import { examRoutes } from './modules/exams/exams.routes.js';
import type { ExamsService } from './modules/exams/exams.service.js';
import { studentRoutes } from './modules/students/students.routes.js';
import type { StudentsService } from './modules/students/students.service.js';
import { teacherRoutes } from './modules/teachers/teachers.routes.js';
import type { TeachersService } from './modules/teachers/teachers.service.js';
import type { CookieSettings } from './shared/http/cookies.js';
import csrfPlugin from './shared/http/csrf.plugin.js';

export interface ApiServices {
  readonly auth: AuthService;
  readonly students: StudentsService;
  readonly teachers: TeachersService;
  readonly examTemplates: ExamTemplatesService;
  readonly exams: ExamsService;
  readonly examEmail: ExamEmailService;
}

export interface ApiOptions {
  /** Publica /api/v1/openapi.json (desligado em produção para não expor o inventário da API). */
  readonly exposeOpenApi: boolean;
  readonly csrfSecret: string;
  readonly cookies: CookieSettings;
  readonly services: ApiServices;
}

/** Tudo o que fica sob /api/v1. */
export const api: FastifyPluginAsyncZod<ApiOptions> = async (app, options) => {
  const { services, cookies } = options;

  if (options.exposeOpenApi) {
    app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  }

  app.decorateRequest('auth', null);
  await app.register(csrfPlugin, { secret: options.csrfSecret, cookies });
  await app.register(authRoutes, { service: services.auth, cookies });

  // Daqui para baixo, tudo exige sessão válida. Negar por padrão (BACKEND.md §1).
  const protectedApi: FastifyPluginAsyncZod = async (scope) => {
    scope.addHook('onRequest', requireAuth(services.auth, cookies));
    await scope.register(teacherRoutes, { service: services.teachers });
    await scope.register(studentRoutes, { service: services.students });
    await scope.register(examTemplateRoutes, { service: services.examTemplates });
    await scope.register(examRoutes, { service: services.exams });
    await scope.register(examEmailRoutes, { service: services.examEmail });
  };
  await app.register(protectedApi);
};
