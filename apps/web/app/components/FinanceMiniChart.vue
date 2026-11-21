<script setup lang="ts">
const props = defineProps<{ values: readonly string[]; kind: 'bars' | 'ring' }>();
const palette = ['#f6ca70', '#76d0ed', '#afd878', '#c8a9ef', '#f08778', '#6ec7b8'];
const parts = computed(() => {
  const values = props.values.map((value) => BigInt(value)).map((value) => (value > 0n ? value : 0n));
  if (props.kind === 'bars') return values.slice(-6);
  const sorted = values.filter((value) => value > 0n).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  return sorted.length > 6 ? [...sorted.slice(0, 5), sorted.slice(5).reduce((a, b) => a + b, 0n)] : sorted;
});
const max = computed(() => parts.value.reduce((a, b) => (a > b ? a : b), 0n));
const gradient = computed(() => {
  const total = parts.value.reduce((a, b) => a + b, 0n);
  if (!total) return undefined;
  let sum = 0n;
  return `conic-gradient(${parts.value
    .map((value, i) => {
      const start = Number((sum * 10000n) / total) / 100;
      sum += value;
      const end = Number((sum * 10000n) / total) / 100;
      return `${palette[i]} ${start}% ${end}%`;
    })
    .join(', ')})`;
});
</script>

<template>
  <span v-if="kind === 'bars' && max" class="mini-finance-bars" aria-hidden="true">
    <i
      v-for="(value, index) in parts"
      :key="index"
      :style="{ height: `${Math.max(5, Number((value * 100n) / max))}%`, background: palette[index % 2] }"
    />
  </span>
  <span
    v-else-if="kind === 'ring'"
    class="mini-finance-ring"
    :class="{ 'mini-finance-ring--empty': !gradient }"
    :style="gradient ? { background: gradient } : undefined"
    aria-hidden="true"
  />
</template>
