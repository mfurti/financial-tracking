export default defineNuxtConfig({
  compatibilityDate: '2026-11-06',
  modules: ['@nuxt/ui'],
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,
  css: ['~/assets/main.css'],
  runtimeConfig: { apiInternalUrl: 'http://127.0.0.1:3001', public: { apiBase: '/api/v1' } },
  app: { head: { htmlAttrs: { lang: 'de' }, title: 'Haushaltsbuch' } },
});
