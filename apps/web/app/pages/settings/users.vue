<script setup lang="ts">
import type { DemoState } from '../../utils/demo-state';
const { state, status, saving, error, execute, reload } = useDemoPortfolio();
const formId = useId();
const editing = ref(false);
const form = reactive({ id: '', name: '', role: 'viewer' as 'owner' | 'viewer' });
const invalid = ref(''),
  notice = ref('');
const blocked = computed(
  /** Corrupt/conflicting storage requires explicit recovery before any synthetic edit. */ () =>
    saving.value || !['ready', 'memory'].includes(status.value),
);

/** Copy only a synthetic display entry into an inert draft; never populate it from the authenticated owner. */
async function edit(entry?: DemoState['roles'][number]) {
  Object.assign(form, entry ?? { id: '', name: '', role: 'viewer' });
  invalid.value = '';
  notice.value = '';
  editing.value = true;
  await nextTick();
  document.getElementById(`${formId}-name`)?.focus();
}

/** Validate and save through the existing isolated demo engine; a failed save preserves the draft. */
async function save() {
  if (blocked.value) return;
  const name = form.name.trim();
  if (!name || name.length > 80 || !['owner', 'viewer'].includes(form.role)) {
    invalid.value = tr('Demo-Anzeigename mit 1 bis 80 Zeichen und eine Demo-Rolle wählen.');
    await nextTick();
    document.getElementById(`${formId}-name`)?.focus();
    return;
  }
  if (!form.id && state.value.roles.length >= 20) {
    invalid.value = tr(
      'Maximal 20 lokale Demo-Einträge. Vorhandenen Eintrag bearbeiten oder die Demo bestätigt zurücksetzen.',
    );
    return;
  }
  if (await execute({ kind: 'role', id: form.id || `demo-${crypto.randomUUID()}`, name, role: form.role })) {
    editing.value = false;
    notice.value = tr('Demo-Rolle gespeichert. Echter Zugang bleibt unverändert.');
  }
}
</script>
<template>
  <UButton to="/settings" variant="link">{{ tr('Zurück zu Einstellungen') }}</UButton>
  <div class="page-heading">
    <h1>{{ tr('Lokale Demo-Rollen') }}</h1>
    <span class="subtle-tag">{{ tr('Simulation') }}</span>
  </div>
  <p class="roles-intro">{{ tr('Es entstehen keine Anmeldungen, Einladungen oder echten Berechtigungen.') }}</p>
  <p class="roles-intro">
    {{
      tr(
        'Diese Anzeige gehört zur Investment-Demo auf diesem Gerät. Der bestehende Eigentümer bleibt alleiniger echter Zugang.',
      )
    }}
  </p>
  <p v-if="status !== 'ready'" role="status" class="roles-notice">
    {{
      status === 'memory'
        ? tr('Nur im Arbeitsspeicher; Änderungen gehen beim Neuladen verloren.')
        : tr('Demo-Speicher prüfen und neu laden, bevor Änderungen gespeichert werden.')
    }}<UButton v-if="status === 'conflict'" variant="soft" @click="reload">{{ tr('Demo neu laden') }}</UButton>
  </p>
  <p v-if="notice" role="status" class="roles-notice">{{ notice }}</p>
  <p v-if="error" role="alert" class="roles-notice">{{ error }}</p>
  <SectionPanel :title="tr('Demo-Anzeigeeinträge')" icon="settings" compact>
    <ul class="demo-role-list">
      <li v-for="entry in state.roles" :key="entry.id" class="demo-role-row" :data-demo-role="entry.id">
        <div>
          <strong>{{ entry.name }}</strong>
          <p>{{ entry.role === 'owner' ? tr('Eigentümer (Demo)') : tr('Betrachter (Demo)') }}</p>
        </div>
        <UButton
          type="button"
          variant="soft"
          :aria-label="tr('{0} bearbeiten', [entry.name])"
          :disabled="blocked"
          @click="edit(entry)"
          >{{ tr('Bearbeiten') }}</UButton
        >
      </li>
    </ul>
    <UButton type="button" variant="soft" :disabled="blocked || state.roles.length >= 20" @click="edit()">{{
      tr('Demo-Eintrag hinzufügen')
    }}</UButton>
  </SectionPanel>
  <SectionPanel v-if="editing" :title="tr('Demo-Anzeigerolle bearbeiten')" icon="settings" compact class="mt-6">
    <p v-if="invalid" role="alert">{{ invalid }}</p>
    <form class="demo-role-form" @submit.prevent="save">
      <fieldset :disabled="blocked">
        <label :for="`${formId}-name`">{{ tr('Demo-Anzeigename') }}</label
        ><input :id="`${formId}-name`" v-model="form.name" type="text" maxlength="80" required autocomplete="off" />
        <label :for="`${formId}-role`">{{ tr('Demo-Anzeigerolle') }}</label
        ><select :id="`${formId}-role`" v-model="form.role">
          <option value="owner">{{ tr('Eigentümer (Demo)') }}</option>
          <option value="viewer">{{ tr('Betrachter (Demo)') }}</option>
        </select>
        <div class="toolbar">
          <UButton type="submit" :loading="saving">{{ tr('Demo-Rolle speichern') }}</UButton
          ><UButton type="button" variant="ghost" @click="editing = false">{{ tr('Abbrechen') }}</UButton>
        </div>
      </fieldset>
    </form>
  </SectionPanel>
  <div v-if="!editing" class="roles-reset"><DemoResetDialog /></div>
</template>
<style scoped>
.roles-intro {
  max-width: 80ch;
  margin-bottom: 16px;
  color: var(--muted);
}
.roles-notice {
  margin-bottom: 20px;
}
.demo-role-list {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}
.demo-role-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  padding: 12px 0;
}
.demo-role-row > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.demo-role-row p {
  color: var(--muted);
  font-size: 13px;
  margin-top: 4px;
}
.demo-role-form fieldset {
  display: grid;
  gap: 12px;
  max-width: 32rem;
  min-width: 0;
}
.demo-role-form input,
.demo-role-form select {
  width: 100%;
  min-width: 0;
}
.roles-reset {
  margin-top: 24px;
}
@media (max-width: 700px) {
  .demo-role-row {
    flex-wrap: wrap;
  }
}
</style>
