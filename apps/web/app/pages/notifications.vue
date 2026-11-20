<script setup lang="ts">
import { z } from 'zod';
import * as c from '@financial-tracking/contracts';
const api = useApi();
const route = useRoute();
const router = useRouter();
const { preferences } = useWorkspacePreferences();
const items = ref<z.infer<typeof c.notificationSchema>[]>([]);
const nextCursor = ref<string | null>(null),
  unread = ref(0);
const kind = ref(String(route.query.kind ?? ''));
const loading = ref(true),
  moreLoading = ref(false),
  ready = ref(false);
const error = ref(''),
  moreError = ref(''),
  savingKey = ref('');
const actionErrors = reactive<Record<string, string>>({});
let generation = 0;
const deviceScope = computed(
  /** Device choices filter visibility only; server read metadata remains durable. */ () =>
    preferences.value.notifications.imports && preferences.value.notifications.payments
      ? 'Importprüfungen und Vertragszahlungen'
      : preferences.value.notifications.imports
        ? 'Nur Importprüfungen'
        : preferences.value.notifications.payments
          ? 'Nur Vertragszahlungen'
          : 'Alle Hinweistypen auf diesem Gerät ausgeblendet',
);
/** Resolve the effective kind without pretending hidden sources do not exist. */
function effectiveKind() {
  if (kind.value && !['IMPORT_REVIEW', 'CONTRACT_DUE'].includes(kind.value)) return kind.value;
  if (kind.value)
    return kind.value === 'IMPORT_REVIEW'
      ? preferences.value.notifications.imports
        ? kind.value
        : null
      : preferences.value.notifications.payments
        ? kind.value
        : null;
  return preferences.value.notifications.imports && preferences.value.notifications.payments
    ? undefined
    : preferences.value.notifications.imports
      ? 'IMPORT_REVIEW'
      : preferences.value.notifications.payments
        ? 'CONTRACT_DUE'
        : null;
}
/** Read current derived events without persisting source amounts in the browser. */
async function load(append = false) {
  const request = append ? generation : ++generation;
  if (append) {
    if (!nextCursor.value || moreLoading.value) return;
    moreLoading.value = true;
    moreError.value = '';
  } else {
    moreError.value = '';
    moreLoading.value = false;
    for (const key of Object.keys(actionErrors)) delete actionErrors[key];
    loading.value = true;
    ready.value = false;
    items.value = [];
    nextCursor.value = null;
    error.value = '';
  }
  try {
    const effective = effectiveKind();
    if (effective === null) {
      items.value = [];
      nextCursor.value = null;
      unread.value = 0;
      ready.value = true;
      return;
    }
    const query = c.notificationsQuerySchema.parse({
      limit: 20,
      cursor: append ? nextCursor.value : undefined,
      kind: effective,
    });
    const result = await api.request('/notifications', c.notificationsSchema, { query });
    if (request !== generation) return;
    items.value = append ? [...items.value, ...result.items] : result.items;
    nextCursor.value = result.nextCursor;
    unread.value = result.unreadCount;
    ready.value = true;
  } catch (caught) {
    if (request === generation) {
      if (append) moreError.value = userErrorMessage(caught);
      else error.value = userErrorMessage(caught);
    }
  } finally {
    if (request === generation) {
      loading.value = false;
      moreLoading.value = false;
    }
  }
}
/** Publish only an explicit validated type filter, retaining durable read acknowledgements. */
async function applyKind() {
  try {
    const query = c.notificationsQuerySchema.parse({ kind: kind.value || undefined });
    await router.replace({ query: query.kind ? { kind: query.kind } : {} });
    await load();
  } catch (caught) {
    error.value = userErrorMessage(caught);
  }
}
/** Save independent acknowledgement metadata; failed actions retain their source row for retry. */
async function acknowledge(item: z.infer<typeof c.notificationSchema>) {
  if (savingKey.value || item.acknowledgedAt) return;
  const request = generation;
  savingKey.value = item.sourceKey;
  actionErrors[item.sourceKey] = '';
  try {
    const saved = await api.request('/notifications/acknowledgement', c.notificationAcknowledgementSchema, {
      method: 'PUT',
      body: { sourceKey: item.sourceKey },
    });
    if (request !== generation) return;
    items.value = items.value.map(
      /** Mark only the confirmed source identity without changing any financial record. */ (row) =>
        row.sourceKey === saved.sourceKey ? { ...row, acknowledgedAt: saved.acknowledgedAt } : row,
    );
    unread.value = Math.max(0, unread.value - 1);
  } catch (caught) {
    if (request === generation) actionErrors[item.sourceKey] = userErrorMessage(caught);
  } finally {
    savingKey.value = '';
  }
}
/** Render real event times separately from planned dates in the Berlin timezone. */
function time(at: string) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(at));
}
onMounted(
  /** Mounting never acknowledges or mutates a source. */ () => {
    void load();
  },
);
watch(
  /** React only to confirmed device source-kind choices. */ () => [
    preferences.value.notifications.imports,
    preferences.value.notifications.payments,
  ],
  /** Discard pages whose visible kind scope changed. */ () => {
    void load();
  },
);
onBeforeUnmount(
  /** Ignore pending reads after leaving this list. */ () => {
    generation++;
  },
);
</script>
<template>
  <div class="page-heading">
    <h1>Benachrichtigungen</h1>
    <UButton variant="soft" :disabled="Boolean(savingKey)" :loading="loading" @click="load()"
      >Hinweise aktualisieren</UButton
    >
  </div>
  <p class="notification-intro">
    Nur Hinweise in dieser App: offene Importprobleme und geplante Vertragszahlungen von heute bis in 30 Tagen. Keine
    E-Mail und keine Push-Nachrichten. Als gelesen markieren ändert keine Buchung oder Zahlung.
  </p>
  <div class="notification-filter">
    <p class="notification-count">
      Gerätefilter: {{ deviceScope }} · <NuxtLink to="/settings">Einstellungen</NuxtLink>
    </p>
    <ChoiceSelect
      v-model="kind"
      aria-label="Hinweistyp"
      :searchable="false"
      :disabled="Boolean(savingKey)"
      :items="[
        { label: 'Alle Hinweise', value: '' },
        { label: 'Importprüfungen', value: 'IMPORT_REVIEW' },
        { label: 'Vertragszahlungen', value: 'CONTRACT_DUE' },
      ]"
      @update:model-value="applyKind"
    />
  </div>
  <p v-if="loading" role="status">Hinweise werden geladen …</p>
  <div v-if="error" role="alert">
    <p>{{ error }}</p>
    <UButton variant="soft" @click="load()">Hinweise erneut laden</UButton>
  </div>
  <SectionPanel v-if="ready" title="Aktuelle Hinweise"
    ><p class="notification-count">{{ unread }} ungelesene Hinweise im gewählten Typ</p>
    <p v-if="effectiveKind() === null">Hinweise dieses Typs sind auf diesem Gerät ausgeblendet.</p>
    <p v-else-if="!items.length">Keine aktuellen Hinweise im gewählten Typ.</p>
    <article
      v-for="item in items"
      :key="item.sourceKey"
      class="notification-row"
      :data-notification-key="item.sourceKey"
    >
      <div>
        <h3>{{ item.kind === 'IMPORT_REVIEW' ? 'Import prüfen' : 'Vertragszahlung geplant' }}</h3>
        <p>
          {{ item.sourceLabel }}<span v-if="item.rowNumber !== null"> · Zeile {{ item.rowNumber }}</span>
        </p>
        <p v-if="item.dueDate">
          Fällig am {{ calendarDate(item.dueDate) }} · <strong data-financial>{{ money(item.plannedCents!) }}</strong> ·
          Planwert, keine bestätigte Zahlung
        </p>
        <time v-else :datetime="item.occurredAt">{{ time(item.occurredAt) }}</time>
        <p v-if="item.acknowledgedAt">Gelesen am {{ time(item.acknowledgedAt) }}</p>
        <p v-else>Ungelesen</p>
        <p v-if="actionErrors[item.sourceKey]" role="alert">{{ actionErrors[item.sourceKey] }}</p>
      </div>
      <div class="notification-actions">
        <UButton :to="item.href" variant="soft">{{
          item.kind === 'IMPORT_REVIEW' ? 'Import öffnen' : 'Vertrag öffnen'
        }}</UButton
        ><UButton
          v-if="!item.acknowledgedAt"
          variant="ghost"
          :disabled="Boolean(savingKey)"
          :loading="savingKey === item.sourceKey"
          @click="acknowledge(item)"
          >Als gelesen markieren</UButton
        >
      </div>
    </article>
    <p v-if="moreError" role="alert">{{ moreError }}</p>
    <UButton v-if="nextCursor" variant="soft" :disabled="Boolean(savingKey)" :loading="moreLoading" @click="load(true)"
      >Weitere Hinweise</UButton
    >
  </SectionPanel>
</template>
<style scoped>
.notification-intro {
  max-width: 90ch;
  margin-bottom: 20px;
}
.notification-filter {
  max-width: 320px;
  margin-bottom: 24px;
}
.notification-count {
  color: var(--muted);
  margin-bottom: 12px;
}
.notification-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding-block: 16px;
  border-bottom: 1px solid var(--line);
}
.notification-row h3,
.notification-row p {
  overflow-wrap: anywhere;
}
.notification-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 8px;
}
time {
  color: var(--muted);
  font-size: 13px;
}
@media (max-width: 700px) {
  .notification-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
