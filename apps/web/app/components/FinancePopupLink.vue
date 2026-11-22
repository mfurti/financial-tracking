<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
const props = defineProps<{ to: RouteLocationRaw; dialogTitle: string; button?: boolean }>();
const popup = useFinancePopup();
const link = resolveComponent('NuxtLink');
const buttonLink = resolveComponent('UButton');
const destination = computed(() => popup?.destination(props.to, props.dialogTitle) ?? props.to);
</script>

<template>
  <component :is="button ? buttonLink : link" :to="destination">
    <slot />
  </component>
</template>
