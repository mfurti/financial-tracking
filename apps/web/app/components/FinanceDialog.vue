<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    dismissible?: boolean;
    panel?: 'profile' | 'groups' | 'calendar' | 'page';
  }>(),
  {
    description: undefined,
    dismissible: true,
    panel: undefined,
  },
);
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
      content: ['finance-dialog finance-dialog-motion', panel && 'finance-dialog--' + panel].filter(Boolean).join(' '),
      overlay: 'finance-overlay finance-dialog-motion',
      body: 'finance-dialog__body',
      title: panel === 'page' ? 'hidden' : undefined,
    }"
  >
    <template v-if="$slots.trigger" #default><slot name="trigger" /></template>
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
  </UModal>
</template>
