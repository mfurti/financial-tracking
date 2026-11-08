<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date';
withDefaults(defineProps<{ label?: string }>(), { label: 'Monat' });
const model = defineModel<string>({ required: true });
const emit = defineEmits<{ change: [month: string] }>();
const open = ref(false);
const value = computed(
  /** Anchor reports to a calendar month without UTC conversion. */ () =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(model.value) ? parseDate(`${model.value}-01`) : undefined,
);
/** Selecting a month changes the same bookmarkable YYYY-MM filter. */
function update(value: unknown) {
  if (!value || typeof value !== 'object' || !('year' in value)) return;
  const date = value as DateValue;
  model.value = `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}`;
  emit('change', model.value);
  open.value = false;
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton color="neutral" variant="outline" :aria-label="label"
      ><FinanceIcon name="calendar" />{{ monthName(model) }}</UButton
    >
    <template #content
      ><UCalendar type="month" :model-value="value" class="p-2" @update:model-value="update"
    /></template>
  </UPopover>
</template>
