<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    value?: string;
    context?: string;
    to?: string;
    actionable?: boolean;
    disabled?: boolean;
    financial?: boolean;
    variant?: 'feature' | 'insight' | 'account' | 'stat';
    state?: 'ready' | 'loading' | 'empty' | 'error';
    emptyText?: string;
    errorText?: string;
  }>(),
  {
    value: undefined,
    context: undefined,
    to: undefined,
    variant: 'feature',
    state: 'ready',
    actionable: false,
    disabled: false,
    financial: false,
    emptyText: 'Noch keine Daten',
    errorText: 'Daten konnten nicht geladen werden.',
  },
);
const emit = defineEmits<{ activate: []; retry: [] }>();
const labelId = useId();
const link = resolveComponent('NuxtLink');
const unavailable = computed(
  /** Disabled or pending/error/empty values must never act like a successful navigation target. */ () =>
    props.disabled || props.state !== 'ready',
);
const target = computed(
  /** Keep the primary action separate from optional sibling controls, avoiding nested buttons/links. */ () =>
    props.to && !unavailable.value ? link : props.actionable ? 'button' : 'div',
);
/** Emit only a ready button action; link navigation remains owned by Nuxt. */
function activate() {
  if (!unavailable.value && props.actionable) emit('activate');
}
</script>

<template>
  <section
    class="finance-tile"
    :class="`finance-tile--${variant}`"
    :aria-labelledby="labelId"
    :aria-busy="state === 'loading'"
    :data-state="state"
    :data-disabled="disabled || undefined"
    :data-interactive="(Boolean(to || actionable) && !unavailable) || undefined"
  >
    <component
      :is="target"
      class="finance-tile__main"
      :to="to && !unavailable ? to : undefined"
      :type="actionable && !to ? 'button' : undefined"
      :disabled="actionable && unavailable ? true : undefined"
      @click="activate"
    >
      <span class="finance-tile__copy">
        <span :id="labelId" class="finance-tile__label">{{ label }}</span>
        <strong v-if="state === 'ready'" class="finance-tile__value" :data-financial="financial || undefined"
          ><template v-if="financial && amountsMasked()">{{ tr('Betrag ausgeblendet') }}</template
          ><slot v-else name="value">{{ value ?? '—' }}</slot></strong
        >
        <span v-else-if="state === 'loading'" role="status">{{ tr('Wird geladen …') }}</span>
        <span v-else-if="state === 'empty'" class="finance-tile__message">{{ tr(emptyText) }}</span>
        <span v-else role="alert" class="finance-tile__message">{{ tr(errorText) }}</span>
        <span v-if="(context || $slots.context) && state === 'ready'" class="finance-tile__context"
          ><slot name="context">{{ context }}</slot></span
        >
      </span>
      <span
        v-if="$slots.graphic && state === 'ready' && !amountsMasked()"
        class="finance-tile__graphic"
        aria-hidden="true"
        ><slot name="graphic"
      /></span>
      <span v-if="(to || actionable) && !unavailable" class="finance-tile__chevron" aria-hidden="true">›</span>
    </component>
    <div v-if="$slots.actions || state === 'error'" class="finance-tile__actions">
      <slot name="actions" />
      <UButton v-if="state === 'error'" type="button" variant="soft" :disabled="disabled" @click="emit('retry')">{{
        tr('Erneut versuchen')
      }}</UButton>
    </div>
  </section>
</template>
