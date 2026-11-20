import { tr } from '../composables/useWorkspaceLocale.js';
import type { AnalysisModuleId } from './workspace-preferences.js';

/** Presentation labels for the six stable device-preference identities; availability is owned by delivered page data. */
export const analysisModuleLabels: Record<AnalysisModuleId, string> = {
  /** Resolve the monthly module label after locale restoration. */ get months() {
    return tr('Monatsvergleich');
  },
  /** Resolve the module label in the currently restored language. */ get categories() {
    return tr('Kategorien');
  },
  /** Resolve the module label in the currently restored language. */ get merchants() {
    return tr('Händler');
  },
  /** Resolve the module label in the currently restored language. */ get history() {
    return tr('Aufgezeichnetes Vermögen');
  },
  /** Resolve the module label in the currently restored language. */ get reserve() {
    return tr('Notgroschen');
  },
  /** Resolve the contract module label after locale restoration. */ get contracts() {
    return tr('Vertragskosten');
  },
};
