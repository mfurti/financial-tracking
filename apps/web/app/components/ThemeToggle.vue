<script setup lang="ts">
const mode = useColorMode();
const isDark = computed(
  /** Start with the resolved device preference until the user makes an explicit choice. */ () => mode.value === 'dark',
);
let transitioning = false;

/** Reveal the new palette from the pointer, or from the toggle for keyboard activation. */
async function toggleTheme(event: MouseEvent) {
  if (transitioning) return;
  const preference = isDark.value ? 'light' : 'dark';
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mode.preference = preference;
    return;
  }
  const root = document.documentElement;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.detail ? event.clientX : rect.left + rect.width / 2;
  const y = event.detail ? event.clientY : rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 1.18;
  try {
    // Keep the selected palette if navigation interrupts the old document before its capture callback.
    localStorage.setItem('haushaltsbuch-theme', preference);
  } catch {
    // Nuxt still applies the in-memory choice when device storage is unavailable.
  }
  transitioning = true;
  root.classList.add('theme-reveal');
  try {
    const transition = document.startViewTransition(async () => {
      mode.preference = preference;
      await nextTick();
    });
    await transition.ready;
    const frames = Array.from({ length: 25 }, (_, index) => {
      const progress = index / 24;
      const points = Array.from({ length: 80 }, (_, point) => {
        const angle = (point * Math.PI) / 40;
        const wave = 1 + Math.sin(angle * 5 + progress * 7) * 0.075 * (1 - progress);
        const distance = radius * progress * wave;
        return `${x + Math.cos(angle) * distance}px ${y + Math.sin(angle) * distance}px`;
      });
      return {
        clipPath: `polygon(${points.join(',')})`,
        filter: `brightness(${1 + 0.07 * Math.sin(progress * Math.PI)})`,
      };
    });
    const animation = root.animate(frames, {
      duration: 1700,
      easing: 'cubic-bezier(.22,.55,.3,1)',
      pseudoElement: '::view-transition-new(root)',
    });
    await animation.finished;
  } catch {
    mode.preference = preference;
  } finally {
    root.classList.remove('theme-reveal');
    transitioning = false;
  }
}
</script>

<template>
  <UButton
    type="button"
    variant="ghost"
    color="neutral"
    class="theme-toggle"
    :class="{ 'is-dark': isDark }"
    :aria-label="tr('Dunkelmodus')"
    :aria-pressed="isDark"
    :title="isDark ? tr('Zum hellen Modus wechseln') : tr('Zum dunklen Modus wechseln')"
    @click="toggleTheme"
  >
    <svg
      class="theme-symbol"
      :style="{ opacity: isDark ? 0.85 : 1 }"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
    >
      <path v-if="isDark" d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />
      <g v-else>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </g>
    </svg>
  </UButton>
</template>
