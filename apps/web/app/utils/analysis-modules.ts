import type { AnalysisModuleId } from './workspace-preferences';

/** Presentation labels for the six stable device-preference identities; availability is owned by delivered page data. */
export const analysisModuleLabels: Record<AnalysisModuleId, string> = {
  months: 'Monatsvergleich',
  categories: 'Kategorien',
  merchants: 'Händler',
  history: 'Aufgezeichnetes Vermögen',
  reserve: 'Notgroschen',
  contracts: 'Vertragskosten',
};
