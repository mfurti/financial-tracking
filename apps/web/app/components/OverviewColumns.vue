<script setup lang="ts">
const layout = ref(measuredLayout());
const columns = computed(
  /** Group independent vertical stacks so a tall bookings list cannot push down the other column's categories. */ () =>
    layout.value === 'desktop'
      ? [['bookings'], ['payments', 'accounts'], ['categories']]
      : layout.value === 'tablet'
        ? [
            ['bookings', 'accounts'],
            ['payments', 'categories'],
          ]
        : [['bookings', 'payments', 'accounts', 'categories']],
);
/** The final integrated reference uses 700 and 1100 CSS-pixel composition boundaries; media queries avoid mobile innerWidth rounding after resize. */
function measuredLayout() {
  if (!import.meta.client || window.matchMedia('(max-width: 700px)').matches) return 'mobile';
  return window.matchMedia('(max-width: 1100px)').matches ? 'tablet' : 'desktop';
}
/** Recompose slot ownership while leaving the parent page's selected month and fetched data intact. */
function resize() {
  layout.value = measuredLayout();
}
onMounted(
  /** Client-first measurement is available before asynchronous overview data arrives. */ () => {
    resize();
    window.addEventListener('resize', resize);
  },
);
onBeforeUnmount(
  /** Release the page-owned listener when leaving the overview. */ () => window.removeEventListener('resize', resize),
);
</script>

<template>
  <div class="finance-overview-columns" :data-layout="layout">
    <div v-for="(column, index) in columns" :key="index" class="finance-overview-column" :data-overview-column="index">
      <template v-for="section in column" :key="section"><slot :name="section" /></template>
    </div>
  </div>
</template>
