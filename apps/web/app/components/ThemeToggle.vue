<script setup lang="ts">
const mode = useColorMode();
const choices = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'system', label: 'System' },
];
</script>

<template>
  <div class="theme-toggle" role="group" aria-label="Darstellung">
    <UButton
      v-for="choice in choices"
      :key="choice.value"
      size="xs"
      color="neutral"
      :variant="mode.preference === choice.value ? 'soft' : 'ghost'"
      :aria-label="`Darstellung: ${choice.label}`"
      :aria-pressed="mode.preference === choice.value"
      @click="mode.preference = choice.value"
      >{{ choice.label }}</UButton
    >
  </div>
</template>
