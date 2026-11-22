import type { InjectionKey, ShallowRef } from 'vue';
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router';

type FinancePopup = {
  background: ShallowRef<RouteLocationNormalizedLoaded | undefined>;
  destination: (to: RouteLocationRaw, title: string) => RouteLocationRaw;
  trackMutation: () => (() => void) | undefined;
};
const financePopupKey: InjectionKey<FinancePopup> = Symbol('financePopup');

/** Keep the opening page mounted while regular routes run inside the dialog. */
export function provideFinancePopup() {
  const router = useRouter();
  const background = shallowRef<RouteLocationNormalizedLoaded>();
  const title = ref('');
  const revision = ref(0);
  const scrollBehavior = router.options.scrollBehavior;
  let originPosition = 0;
  let focusCandidate: HTMLElement | undefined;
  let opener: HTMLElement | undefined;
  let modified = false;
  let closing = false;
  router.options.scrollBehavior = (...args) => (background.value ? false : scrollBehavior?.(...args));

  function close() {
    const position = Number(router.options.history.state.position);
    if (!closing && background.value && position > originPosition) {
      closing = true;
      router.go(originPosition - position);
    }
  }

  const removeBefore = router.beforeEach(() => {
    if (!background.value && document.activeElement instanceof HTMLElement) focusCandidate = document.activeElement;
  });
  const removeAfter = router.afterEach((to, from, failure) => {
    closing = false;
    if (failure) return;
    const state = router.options.history.state;
    const position = Number(state.position);
    if (background.value && (position <= originPosition || to.path === '/login')) {
      background.value = undefined;
      if (modified) revision.value++;
      modified = false;
      const target = opener;
      opener = undefined;
      if (to.path !== '/login') {
        void nextTick(() => {
          if (!background.value) {
            const element = target?.isConnected ? target : document.querySelector<HTMLElement>('#main-content');
            element?.focus({ preventScroll: true });
          }
        });
      }
      return;
    }
    if (background.value && to.fullPath === background.value.fullPath) {
      close();
      return;
    }
    if (
      !background.value &&
      from.matched.length &&
      state.financePopupOrigin === from.fullPath &&
      typeof state.financePopupPosition === 'number' &&
      position > state.financePopupPosition
    ) {
      background.value = from;
      originPosition = state.financePopupPosition;
      opener = focusCandidate;
    }
    if (background.value && typeof state.financePopupTitle === 'string') title.value = state.financePopupTitle;
  });
  onScopeDispose(() => {
    router.options.scrollBehavior = scrollBehavior;
    removeBefore();
    removeAfter();
  });

  provide(financePopupKey, {
    background,
    destination(to, caption) {
      const { path, query, hash } = router.resolve(to);
      return {
        path,
        query,
        hash,
        state: {
          financePopupOrigin: background.value?.fullPath ?? router.currentRoute.value.fullPath,
          financePopupPosition: background.value ? originPosition : Number(router.options.history.state.position),
          financePopupTitle: caption,
        },
      };
    },
    trackMutation() {
      const origin = background.value?.fullPath;
      if (!origin) return;
      return () => {
        if (background.value?.fullPath === origin) modified = true;
        else if (router.currentRoute.value.fullPath === origin) revision.value++;
      };
    },
  });

  return { background, title, revision, close };
}

export function useFinancePopup() {
  return hasInjectionContext() ? inject(financePopupKey, null) : null;
}
