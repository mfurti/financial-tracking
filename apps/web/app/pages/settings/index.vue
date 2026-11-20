<script setup lang="ts">
const api = useApi();
const { preferences, storageState, updatePreferences } = useWorkspacePreferences();
/** Change only the validated local visual privacy preference. */
function setMask(checked: boolean | 'indeterminate') {
  updatePreferences({ maskAmounts: checked === true });
}
/** Configure the visible in-app source kinds without enabling email, push or financial actions. */
function setNotification(kind: 'imports' | 'payments', checked: boolean | 'indeterminate') {
  updatePreferences({ notifications: { ...preferences.value.notifications, [kind]: checked === true } });
}
</script>
<template>
  <div class="page-heading"><h1>Einstellungen</h1></div>
  <p class="settings-intro">
    Profil und Kontogruppen bleiben auf dem Server. Darstellung, Analyseauswahl und Privatsphäre gelten auf diesem
    Gerät.
  </p>
  <div class="settings-links">
    <FinanceTile
      label="Mein Profil"
      value="Anzeige & Kontakt"
      context="Eigentümerprofil · Anmeldung bleibt unverändert"
      to="/settings/profile"
    />
    <FinanceTile
      label="Kontogruppen"
      value="Konten ordnen"
      context="Dauerhafte Gruppen für gemeinsame Auswertungen"
      to="/settings/account-groups"
    />
    <FinanceTile
      label="Darstellung"
      value="Farben & Helligkeit"
      context="Vorhandene Themen und Hell/Dunkel auf diesem Gerät"
      to="/settings/appearance"
    />
    <FinanceTile
      label="Passwort"
      value="Zugang ändern"
      context="Aktuelles Passwort nötig · meldet alle Sitzungen ab"
      to="/settings/password"
    />
    <FinanceTile
      label="Analysen"
      :value="`${preferences.analysisModules.length} ausgewählte Module`"
      context="Über Anpassen in der Analyse ändern · dieses Gerät"
      to="/analytics"
    />
    <FinanceTile
      label="Benachrichtigungen"
      value="Importe & Fälligkeiten"
      context="Hinweise ausschließlich innerhalb dieser App"
      to="/notifications"
    />
  </div>
  <p v-if="storageState !== 'ready'" role="status">
    Geräteeinstellungen sind hier nicht dauerhaft verfügbar. Änderungen gelten gegebenenfalls nur bis zum Neuladen.
  </p>
  <div class="settings-sections">
    <SectionPanel title="Privatsphäre auf diesem Gerät"
      ><UCheckbox
        :model-value="preferences.maskAmounts"
        label="Finanzbeträge visuell ausblenden"
        @update:model-value="setMask"
      />
      <p class="settings-help">
        Darstellungsoption für finanzielle Werte, keine zusätzliche Zugriffsbeschränkung.
      </p></SectionPanel
    >
    <SectionPanel title="Hinweise in dieser App"
      ><UCheckbox
        :model-value="preferences.notifications.imports"
        label="Importprüfungen anzeigen"
        @update:model-value="setNotification('imports', $event)"
      /><UCheckbox
        :model-value="preferences.notifications.payments"
        label="Geplante Vertragszahlungen anzeigen"
        @update:model-value="setNotification('payments', $event)"
      />
      <p class="settings-help">
        Filter auf diesem Gerät. Lesebestätigungen bleiben auf dem Server; E-Mail und Push werden nicht versendet.
      </p></SectionPanel
    >
  </div>
  <FinanceTile label="Benutzer" :value="api.session.value?.username" context="Privater Finanzbereich" variant="account">
    <template #actions>
      <FinanceDialog
        title="Benutzer- und App-Informationen"
        description="Zugang, Währung und Datensicherung deines Finanzbereichs."
      >
        <template #trigger><UButton type="button" variant="soft">Zugang & Datensicherung</UButton></template>
        <dl class="detail-list">
          <dt>Benutzer</dt>
          <dd>{{ api.session.value?.username }}</dd>
          <dt>Währung</dt>
          <dd>EUR</dd>
          <dt>Zeitzone</dt>
          <dd>Europe/Berlin</dd>
          <dt>Bankabruf</dt>
          <dd>Manuell · keine dauerhaft gespeicherte Bank-PIN</dd>
          <dt>Datensicherung</dt>
          <dd>Verschlüsselt auf dem Server; Status hier nicht verfügbar.</dd>
          <dt>Zugang</dt>
          <dd>Ausschließlich Heimnetz/VPN mit HTTPS.</dd>
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
