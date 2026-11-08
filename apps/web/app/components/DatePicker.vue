<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date';
const props = defineProps<{ label: string; disabled?: boolean }>();
const model = defineModel<string>({ default: '' });
const open = ref(false);
const value = computed(
  /** Parse only a calendar date; never convert through a timezone. */ () => {
    try {
      return model.value ? parseDate(model.value) : undefined;
    } catch {
      return undefined;
    }
  },
);
/** Keep clearing and keyboard/calendar changes in the same ISO-date contract. */
function update(date: unknown) {
  if (!date) model.value = '';
  else if (typeof date === 'object' && 'year' in date) model.value = (date as DateValue).toString();
}
</script>

<template>
  <UInputDate
    :model-value="value"
    :aria-label="props.label"
    :disabled="disabled"
    class="w-full"
    @update:model-value="update"
  >
    <template #trailing>
      <UButton
        v-if="model"
        color="neutral"
        variant="link"
        size="xs"
        :aria-label="`${label} löschen`"
        :disabled="disabled"
        @click="model = ''"
        >×</UButton
      >
      <UPopover v-model:open="open">
        <UButton color="neutral" variant="link" size="xs" :aria-label="`${label} auswählen`" :disabled="disabled"
          ><FinanceIcon name="calendar"
        /></UButton>
        <template #content
          ><UCalendar
            :model-value="value"
            class="p-2"
            @update:model-value="
              update($event);
              open = false;
            "
        /></template>
      </UPopover>
    </template>
  </UInputDate>
</template>
