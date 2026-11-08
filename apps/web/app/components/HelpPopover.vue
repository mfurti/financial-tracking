<script setup lang="ts">
defineProps<{ title: string; text?: string }>();
</script>

<template>
  <UPopover>
    <UButton color="neutral" variant="ghost" size="sm" class="help-button" :aria-label="`Hilfe: ${title}`"
      ><span aria-hidden="true">?</span></UButton
    >
    <template #content
      ><div class="help-copy">
        <strong>{{ title }}</strong>
        <p v-if="text" class="mt-2">{{ text }}</p>
        <slot /></div
    ></template>
  </UPopover>
</template>
