export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  // Enquanto o back-end não existe, um interceptor simula a API (ver src/app/mock-api).
  // Quando a API real estiver pronta, troque para false.
  useMockApi: true,
};
