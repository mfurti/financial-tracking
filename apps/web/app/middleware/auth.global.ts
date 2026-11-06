import { sessionSchema } from '@financial-tracking/contracts';

export default defineNuxtRouteMiddleware(
  /** Recover an existing cookie session before entering private views. */ async (to) => {
    if (to.path === '/login') return;
    const api = useApi();
    if (!api.session.value) {
      try {
        api.session.value = await api.request('/auth/session', sessionSchema);
      } catch {
        return navigateTo('/login');
      }
    }
  },
);
