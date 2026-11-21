<script setup lang="ts">
const api = useApi();
const { preferences, storageState, updatePreferences } = useWorkspacePreferences();
/** Change only the validated local visual privacy preference. */
function setMask(checked: boolean | 'indeterminate') {
  updatePreferences({ maskAmounts: checked === true });
}
/** Apply a supported device language; the app remounts the current settings view with translated setup labels. */
function setLanguage(value: unknown) {
  if (value === 'de' || value === 'en') updatePreferences({ language: value });
}
/** Configure the visible in-app source kinds without enabling email, push or financial actions. */
function setNotification(kind: 'imports' | 'payments', checked: boolean | 'indeterminate') {
  updatePreferences({ notifications: { ...preferences.value.notifications, [kind]: checked === true } });
}
</script>
<template>
  <div class="page-heading">
    <h1>{{ tr('Einstellungen') }}</h1>
  </div>
  <p class="settings-intro">
    {{
      tr(
        'Profil und Kontogruppen bleiben auf dem Server. Darstellung, Analyseauswahl und Privatsphäre gelten auf diesem Gerät.',
      )
    }}
  </p>
  <div class="settings-links">
    <FinanceTile
      :label="tr('Mein Profil')"
      :value="tr('Anzeige & Kontakt')"
      :context="tr('Eigentümerprofil · Anmeldung bleibt unverändert')"
      to="/settings/profile"
    />
    <FinanceTile
      :label="tr('Kontogruppen')"
      :value="tr('Konten ordnen')"
      :context="tr('Dauerhafte Gruppen für gemeinsame Auswertungen')"
      to="/settings/account-groups"
    />
    <FinanceTile
      :label="tr('Darstellung')"
      :value="tr('Farben & Helligkeit')"
      :context="tr('Vorhandene Themen und Hell/Dunkel auf diesem Gerät')"
      to="/settings/appearance"
    />
    <FinanceTile
      :label="tr('Passwort')"
      :value="tr('Zugang ändern')"
      :context="tr('Aktuelles Passwort nötig · meldet alle Sitzungen ab')"
      to="/settings/password"
    />
    <FinanceTile
      :label="tr('Analysen')"
      :value="tr('{0} ausgewählte Module', [preferences.analysisModules.length])"
      :context="tr('Über Anpassen in der Analyse ändern · dieses Gerät')"
      to="/analytics"
    />
    <FinanceTile
      :label="tr('Benachrichtigungen')"
      :value="tr('Importe & Fälligkeiten')"
      :context="tr('Hinweise ausschließlich innerhalb dieser App')"
      to="/notifications"
    />
    <FinanceTile
      :label="tr('Lokale Demo-Rollen')"
      :value="tr('Synthetische Anzeigeeinträge')"
      :context="tr('Keine echten Nutzer oder Berechtigungen · dieses Gerät')"
      to="/settings/users"
    />
  </div>
  <p v-if="storageState !== 'ready'" role="status">
    {{
      tr(
        'Geräteeinstellungen sind hier nicht dauerhaft verfügbar. Änderungen gelten gegebenenfalls nur bis zum Neuladen.',
      )
    }}
  </p>
  <div class="settings-sections">
    <SectionPanel :title="tr('Sprache auf diesem Gerät')">
      <ChoiceSelect
        :model-value="preferences.language"
        :aria-label="tr('Sprache')"
        :items="[
          { label: 'Deutsch', value: 'de' },
          { label: 'English', value: 'en' },
        ]"
        @update:model-value="setLanguage"
      />
    </SectionPanel>
    <SectionPanel :title="tr('Privatsphäre auf diesem Gerät')"
      ><UCheckbox
        :model-value="preferences.maskAmounts"
        :label="tr('Finanzbeträge visuell ausblenden')"
        @update:model-value="setMask"
      />
      <p class="settings-help">
        {{ tr('Darstellungsoption für finanzielle Werte, keine zusätzliche Zugriffsbeschränkung.') }}
      </p></SectionPanel
    >
    <SectionPanel :title="tr('Hinweise in dieser App')"
      ><UCheckbox
        :model-value="preferences.notifications.imports"
        :label="tr('Importprüfungen anzeigen')"
        @update:model-value="setNotification('imports', $event)"
      /><UCheckbox
        :model-value="preferences.notifications.payments"
        :label="tr('Geplante Vertragszahlungen anzeigen')"
        @update:model-value="setNotification('payments', $event)"
      />
      <p class="settings-help">
        {{
          tr(
            'Filter auf diesem Gerät. Lesebestätigungen bleiben auf dem Server; E-Mail und Push werden nicht versendet.',
          )
        }}
      </p></SectionPanel
    >
  </div>
  <FinanceTile
    :label="tr('Benutzer')"
    :value="api.session.value?.username"
    :context="tr('Privater Finanzbereich')"
    variant="account"
  >
    <template #actions>
      <FinanceDialog
        :title="tr('Benutzer- und App-Informationen')"
        :description="tr('Zugang, Währung und Datensicherung deines Finanzbereichs.')"
      >
        <template #trigger
          ><UButton type="button" variant="soft">{{ tr('Zugang & Datensicherung') }}</UButton></template
        >
        <dl class="detail-list">
          <dt>{{ tr('Benutzer') }}</dt>
          <dd>{{ api.session.value?.username }}</dd>
          <dt>{{ tr('Währung') }}</dt>
          <dd>EUR</dd>
          <dt>{{ tr('Zeitzone') }}</dt>
          <dd>{{ tr('Europe/Berlin') }}</dd>
          <dt>{{ tr('Bankabruf') }}</dt>
          <dd>{{ tr('Manuell · keine dauerhaft gespeicherte Bank-PIN') }}</dd>
          <dt>{{ tr('Datensicherung') }}</dt>
          <dd>{{ tr('Verschlüsselt auf dem Server; Status hier nicht verfügbar.') }}</dd>
          <dt>{{ tr('Zugang') }}</dt>
          <dd>{{ tr('Ausschließlich Heimnetz/VPN mit HTTPS.') }}</dd>
        </dl>
      </FinanceDialog>
    </template>
  </FinanceTile>
</template>
<style scoped>
.settings-intro {
  max-width: 90ch;
  margin-bottom: 24px;
  color: var(--muted);
}
.settings-links {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}
.settings-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 28px;
}
.settings-links > *,
.settings-sections > * {
  min-width: 0;
}
.settings-help {
  margin-top: 12px;
  color: var(--muted);
  font-size: 13px;
}
@media (max-width: 1100px) {
  .settings-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .settings-links,
  .settings-sections {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
