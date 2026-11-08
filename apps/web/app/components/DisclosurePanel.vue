<script setup lang="ts">
defineProps<{ title: string }>();
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <UAccordion
    :items="[{ label: title, value: 'body' }]"
    :model-value="open ? 'body' : undefined"
    :unmount-on-hide="false"
    @update:model-value="open = $event === 'body'"
  >
    <template #body><slot /></template>
  </UAccordion>
</template>
