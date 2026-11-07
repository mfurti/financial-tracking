import { appearanceBootstrap, appearanceStyleSheet } from './app/utils/appearance';

export default defineNuxtConfig({
  compatibilityDate: '2026-11-06',
  modules: ['@nuxt/ui'],
  ssr: false,
  devtools: { enabled: false },
  telemetry: false,
  colorMode: { preference: 'system', fallback: 'light', storageKey: 'haushaltsbuch-theme', classSuffix: '' },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    apiInternalUrl: 'http://127.0.0.1:3001',
    requireTrustedProxy: process.env.NODE_ENV === 'production',
    trustedProxyHost: 'traefik',
    public: { apiBase: '/api/v1' },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'Haushaltsbuch',
      script: [{ key: 'appearance-preference', innerHTML: appearanceBootstrap() }],
      style: [{ key: 'appearance-palettes', innerHTML: appearanceStyleSheet() }],
    },
  },
});
