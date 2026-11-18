<script setup lang="ts">
const width = ref(import.meta.client ? window.innerWidth : 0);
const layout = computed(
  /** The final integrated reference uses 700 and 1100 CSS-pixel composition boundaries. */ () =>
    width.value > 1100 ? 'desktop' : width.value > 700 ? 'tablet' : 'mobile',
);
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
/** Recompose slot ownership while leaving the parent page's selected month and fetched data intact. */
function resize() {
  width.value = window.innerWidth;
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
