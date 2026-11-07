<script setup lang="ts">
const mode = useColorMode();
const isDark = computed(
  /** Start with the resolved device preference until the user makes an explicit choice. */ () => mode.value === 'dark',
);
let transitionTimer: ReturnType<typeof setTimeout> | undefined;

/** Toggle one persisted preference and animate colors only for this deliberate user action. */
function toggleTheme() {
  if (transitionTimer) clearTimeout(transitionTimer);
  document.documentElement.classList.remove('theme-transition');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('theme-transition');
    transitionTimer = setTimeout(
      /** Avoid animating unrelated future UI changes. */ () => {
        document.documentElement.classList.remove('theme-transition');
        transitionTimer = undefined;
      },
      320,
    );
  }
  mode.preference = isDark.value ? 'light' : 'dark';
}
onBeforeUnmount(
  /** Clear the global animation class when moving between login and app layouts. */ () => {
    if (transitionTimer) clearTimeout(transitionTimer);
    document.documentElement.classList.remove('theme-transition');
  },
);
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ 'is-dark': isDark }"
    aria-label="Dunkelmodus"
    :aria-pressed="isDark"
    :title="isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'"
    @click="toggleTheme"
  >
    <span class="theme-toggle-thumb" aria-hidden="true" />
    <svg
      class="theme-sun"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </svg>
    <svg
      class="theme-moon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />
    </svg>
  </button>
</template>
