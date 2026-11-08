<script setup lang="ts">
defineProps<{ title: string }>();
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <!-- Keep form controls stationary when scrolling into a newly opened panel. -->
  <UAccordion
    :items="[{ label: title, value: 'body' }]"
    :model-value="open ? 'body' : undefined"
    :unmount-on-hide="false"
    :ui="{ content: 'data-[state=open]:animate-none data-[state=closed]:animate-none' }"
    @update:model-value="open = $event === 'body'"
  >
    <template #body><slot /></template>
  </UAccordion>
</template>
