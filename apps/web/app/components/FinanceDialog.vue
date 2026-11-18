<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; dismissible?: boolean }>(), {
  description: undefined,
  dismissible: true,
});
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="dismissible"
    :transition="true"
    :ui="{
      content: 'finance-dialog finance-dialog-motion',
      overlay: 'finance-overlay finance-dialog-motion',
      body: 'finance-dialog__body',
    }"
  >
    <template v-if="$slots.trigger" #default><slot name="trigger" /></template>
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </UModal>
</template>
