<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
type Proposal = z.infer<typeof c.contractSuggestionSchema>;
const props = defineProps<{ suggestions: Proposal[]; accounts: c.Account[]; categories: c.Category[] }>();
const emit = defineEmits<{ changed: []; openChange: [value: boolean] }>();
const api = useApi();
const open = ref(false);
const queue = ref<Proposal[]>([]);
const dismissed = ref<Proposal[]>([]);
const current = ref(0);
const done = reactive(new Set<string>());
const dirty = ref(false);
const busy = ref(false);
const error = ref('');
const discardOpen = ref(false);
const restoring = ref(false);
const reducedMotion = ref(false);
const carousel = useTemplateRef('carousel');
const form = useTemplateRef('form');
let pending: (() => void) | null = null;
let routeDecision: ((value: boolean) => void) | null = null;
let changed = false;
let media: MediaQueryList | undefined;
const finished = computed(
  /** A skipped item is complete only for this in-memory review round. */ () =>
    queue.value.length > 0 && done.size === queue.value.length,
);
const dialogOpen = computed({
  get: /** Bind modal visibility without giving dismissal direct write access. */ () => open.value,
  set: /** Escape, outside interaction and the close button use the same dirty-form guard. */ (value: boolean) => {
    if (!value) request(close);
  },
});
/** Apply the user's OS motion preference to Embla's scroll animation. */
function motion() {
  reducedMotion.value = media?.matches ?? false;
}
/** Close the review before telling its parent to reload persisted proposals. */
function close() {
  open.value = false;
  emit('openChange', false);
  if (changed) {
    changed = false;
    emit('changed');
  }
}
/** Snapshot proposals so background reads never replace active edits. */
async function start(showDismissed = false) {
  queue.value = [...props.suggestions];
  current.value = 0;
  done.clear();
  dirty.value = false;
  error.value = '';
  changed = false;
  restoring.value = showDismissed;
  open.value = true;
  emit('openChange', true);
  await readDismissed();
}
/** Read only currently eligible rejected patterns; obsolete patterns need no review card. */
async function readDismissed() {
  try {
    dismissed.value = await api.request('/contracts/suggestions', z.array(c.contractSuggestionSchema), {
      query: { dismissed: 'true' },
    });
  } catch (cause) {
    error.value = userErrorMessage(cause);
  }
}
/** Defer any destructive-to-edits action until the user has chosen to discard. */
function request(action: () => void) {
  if (busy.value) return;
  if (dirty.value) {
    pending = action;
    discardOpen.value = true;
  } else action();
}
/** Move the real carousel after resolving edits, never accepting/rejecting a proposal. */
function move(index: number) {
  if (index < 0 || index >= queue.value.length) return;
  dirty.value = false;
  current.value = index;
  carousel.value?.emblaApi?.scrollTo(index, reducedMotion.value);
}
/** Swipes and carousel arrow keys are navigation; revert first if a dirty card needs consent. */
function selected(index: number) {
  if (index === current.value) return;
  if (busy.value || discardOpen.value) {
    carousel.value?.emblaApi?.scrollTo(current.value, true);
    return;
  }
  if (dirty.value) {
    carousel.value?.emblaApi?.scrollTo(current.value, true);
    request(/** Resume the exact requested destination after discard. */ () => move(index));
  } else move(index);
}
/** Inputs, buttons and nested dialogs must never initiate a carousel drag. */
function drag(_api: unknown, event: MouseEvent | TouchEvent) {
  return (
    !busy.value &&
    !discardOpen.value &&
    event.target instanceof Element &&
    !event.target.closest('form,button,input,textarea,select,a,[role="button"],[role="radio"],[role="combobox"]')
  );
}
/** Complete one explicit action and locate the next unprocessed card. */
function advance() {
  const item = queue.value[current.value];
  if (item) done.add(item.key);
  dirty.value = false;
  for (let offset = 1; offset <= queue.value.length; offset++) {
    const index = (current.value + offset) % queue.value.length;
    if (!done.has(queue.value[index]!.key)) {
      move(index);
      return;
    }
  }
}
/** A successful form save already confirmed its source decision atomically on the server. */
function saved() {
  changed = true;
  busy.value = false;
  advance();
}
/** Reject only after the visible button (and optional edit-discard confirmation). */
async function reject() {
  const item = queue.value[current.value];
  if (!item) return;
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/contracts/suggestions/${item.key}/decision`, z.object({ ok: z.boolean() }), {
      method: 'PUT',
      body: c.suggestionDecisionSchema.parse({ decision: 'DISMISSED' }),
    });
    changed = true;
    advance();
    await readDismissed();
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Restore a rejected proposal into this round without touching another edited card. */
async function restore(item: Proposal) {
  busy.value = true;
  error.value = '';
  try {
    await api.request(`/contracts/suggestions/${item.key}/decision`, z.object({ ok: z.boolean() }), {
      method: 'DELETE',
    });
    if (!queue.value.some(/** Do not duplicate a card restored in the same round. */ (row) => row.key === item.key))
      queue.value.push(item);
    done.delete(item.key);
    changed = true;
    move(queue.value.findIndex(/** Open the explicit restored pattern. */ (row) => row.key === item.key));
    await readDismissed();
    restoring.value = false;
  } catch (cause) {
    error.value = userErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
/** Cancel a pending navigation and resolve a browser-route guard without discarding edits. */
function cancelDiscard() {
  pending = null;
  discardOpen.value = false;
  routeDecision?.(false);
  routeDecision = null;
}
/** Discard local edits only after confirmation, then execute the original requested action. */
function discard() {
  form.value?.reset();
  dirty.value = false;
  discardOpen.value = false;
  const action = pending;
  pending = null;
  action?.();
}
onBeforeRouteLeave(
  /** Protect edits when navigating away through the browser or application. */ () => {
    if (!open.value || !dirty.value) return !busy.value;
    return new Promise<boolean>(
      /** Resume router navigation only after the explicit edit decision. */ (resolve) => {
        routeDecision = resolve;
        request(
          /** Continue the previously blocked router action. */ () => {
            routeDecision?.(true);
            routeDecision = null;
          },
        );
      },
    );
  },
);
onMounted(
  /** Observe reduced motion without adding another dependency. */ () => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion();
    media.addEventListener('change', motion);
  },
);
onBeforeUnmount(
  /** Release local listeners and any unresolved navigation decision. */ () => {
    media?.removeEventListener('change', motion);
    routeDecision?.(false);
    emit('openChange', false);
  },
);
</script>

<template>
  <div class="toolbar">
    <UButton :disabled="!suggestions.length" @click="start()">Vorschläge prüfen · {{ suggestions.length }}</UButton
    ><UButton color="neutral" variant="ghost" @click="start(true)">Ausgeblendete Vorschläge</UButton>
  </div>
  <UModal
    v-model:open="dialogOpen"
    title="Vertragsvorschläge prüfen"
    description="Bearbeiten und bestätigen. Wischen blättert nur."
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <UAlert v-if="error" role="alert" color="error" :description="error" class="mb-4" />
      <div v-if="finished || !queue.length" class="empty-state">
        <FinanceIcon name="contracts" />
        <h3>{{ finished ? 'Prüfrunde abgeschlossen' : 'Keine offenen Vorschläge' }}</h3>
        <UButton variant="soft" @click="close">Verträge anzeigen</UButton>
      </div>
      <template v-else>
        <p class="muted mb-4" role="status">{{ current + 1 }} von {{ queue.length }} · {{ done.size }} bearbeitet</p>
        <UCarousel
          ref="carousel"
          :items="queue"
          :start-index="current"
          :loop="false"
          :duration="reducedMotion ? 0 : 25"
          :watch-drag="drag"
          :ui="{ item: 'basis-full', container: 'items-start' }"
          aria-label="Vertragsvorschläge"
          @select="selected"
        >
          <template #default="{ item, index }">
            <article
              :aria-hidden="index !== current"
              :inert="index !== current"
              class="review-proposal"
              :aria-label="item.provider"
            >
              <div class="review-swipe-zone">
                <h3>{{ item.provider }}</h3>
                <strong class="amount-expense">{{ money(item.amountCents) }}</strong
                ><UBadge variant="soft">{{ item.count }} Zahlungen</UBadge>
              </div>
              <template v-if="index === current && !done.has(item.key)">
                <DisclosurePanel title="Zugrunde liegende Zahlungen" class="mb-4"
                  ><UButton v-for="id in item.transactionIds" :key="id" :to="`/transactions/${id}`" variant="link"
                    >Buchung ansehen</UButton
                  ></DisclosurePanel
                >
                <div @keydown.left.stop @keydown.right.stop>
                  <ContractForm
                    ref="form"
                    :key="item.key"
                    :suggestion="item"
                    :accounts="accounts"
                    :categories="categories"
                    submit-label="Bestätigen & weiter"
                    @dirty="dirty = $event"
                    @busy="busy = $event"
                    @saved="saved"
                  />
                </div>
                <div class="toolbar mt-4">
                  <UButton color="neutral" variant="soft" :disabled="busy" @click="request(advance)">Später</UButton
                  ><UButton
                    color="neutral"
                    variant="ghost"
                    :disabled="busy"
                    @click="
                      request(
                        /** A button is explicit rejection consent; swipes never call this. */ () => {
                          void reject();
                        },
                      )
                    "
                    >Kein Vertrag</UButton
                  >
                </div>
              </template>
              <p v-else-if="done.has(item.key)" class="muted">Für diese Prüfrunde erledigt.</p>
            </article>
          </template>
        </UCarousel>
        <div class="toolbar mt-5">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="busy || current === 0"
            @click="request(/** Navigate only after resolving the current edits. */ () => move(current - 1))"
            >Vorherige Karte</UButton
          ><UButton
            color="neutral"
            variant="outline"
            :disabled="busy || current >= queue.length - 1"
            @click="request(/** Navigate only, without accepting the next proposal. */ () => move(current + 1))"
            >Nächste Karte</UButton
          >
        </div>
      </template>
      <DisclosurePanel v-model:open="restoring" title="Ausgeblendete Vorschläge" class="mt-5"
        ><p v-if="!dismissed.length" class="muted">Keine ausgeblendeten Vorschläge.</p>
        <div v-for="item in dismissed" :key="item.key" class="editable-row">
          <span>{{ item.provider }} · {{ money(item.amountCents) }}</span
          ><UButton
            :disabled="busy"
            variant="soft"
            @click="
              request(
                /** Restoring must not silently discard edits on the current card. */ () => {
                  void restore(item);
                },
              )
            "
            >Wiederherstellen</UButton
          >
        </div></DisclosurePanel
      >
    </template>
    <template #footer
      ><UButton color="neutral" variant="ghost" :disabled="busy" @click="request(close)"
        >Prüfung schließen</UButton
      ></template
    >
  </UModal>
  <UModal
    :open="discardOpen"
    title="Ungespeicherte Änderungen"
    description="Deine Änderungen wurden noch nicht gespeichert."
    @update:open="
      /** Closing the confirmation is cancellation, not consent. */ (value) => {
        if (!value) cancelDiscard();
      }
    "
    ><template #footer
      ><UButton variant="soft" @click="cancelDiscard">Weiter bearbeiten</UButton
      ><UButton color="warning" @click="discard">Änderungen verwerfen</UButton></template
    ></UModal
  >
</template>
