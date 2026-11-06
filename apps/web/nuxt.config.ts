export default defineNuxtConfig({
  compatibilityDate: '2026-11-06',
  modules: ['@nuxt/ui'],
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,
  css: ['~/assets/main.css'],
  runtimeConfig: { public: { apiBase: '/api/v1' } },
  nitro: { routeRules: { '/api/**': { proxy: `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001'}/api/**` } } },
  app: { head: { htmlAttrs: { lang: 'de' }, title: 'Haushaltsbuch' } },
});
