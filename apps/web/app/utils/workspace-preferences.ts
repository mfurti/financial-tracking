import { resolveCustomAppearance, type CustomAppearance } from './appearance.js';
/** Dedicated device-only namespace; no account, financial or session payload belongs here. */
export const workspacePreferencesKey = 'haushaltsbuch-workspace-v1';
/** Allowlisted analysis destinations, in the integrated concept's default order. */
export const analysisModuleIds = ['months', 'categories', 'merchants', 'history', 'reserve', 'contracts'] as const;
/** Stable analysis identity, independent of translated display labels. */
export type AnalysisModuleId = (typeof analysisModuleIds)[number];
/** Version-one device choices; custom tones stay null until the owned contrast-validation slice is delivered. */
/** T041 accepts only fully validated paired custom tones; missing/legacy values remain null. */
export type WorkspacePreferences = {
  version: 1;
  language: 'de' | 'en';
  maskAmounts: boolean;
  analysisModules: AnalysisModuleId[];
  chart: 'bar' | 'ring';
  custom: CustomAppearance | null;
  notifications: { payments: boolean; imports: boolean };
};
/** Restore/save outcome exposed separately from usable in-memory preferences. */
export type PreferenceStorageState = 'ready' | 'invalid' | 'unsupported' | 'unavailable';
/** Minimal read boundary supports blocked/corrupt-storage checks without a browser global. */
type PreferenceReader = { getItem(key: string): string | null };
/** Minimal write boundary prevents unrelated theme/storage operations. */
type PreferenceWriter = { setItem(key: string, value: string): void };

/** Return fresh defaults so one component cannot mutate another caller's fallback. */
export function defaultWorkspacePreferences(): WorkspacePreferences {
  return {
    version: 1,
    language: 'de',
    maskAmounts: false,
    analysisModules: [...analysisModuleIds],
    chart: 'bar',
    custom: null,
    notifications: { payments: true, imports: true },
  };
}

/** Treat only plain JSON-shaped objects as preference records. */
function preferenceRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Recover supported device fields, migrate legacy names, and discard every unknown payload field. */
export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences {
  const record = preferenceRecord(value);
  const fallback = defaultWorkspacePreferences();
  if (!record || (record.version !== undefined && record.version !== 0 && record.version !== 1)) return fallback;
  const modules = Array.isArray(record.analysisModules)
    ? record.analysisModules
    : Array.isArray(record.modules)
      ? record.modules
      : fallback.analysisModules;
  const selected = modules.filter(
    /** Unknown names cannot become arbitrary routes or duplicate module identities. */ (
      item,
    ): item is AnalysisModuleId => typeof item === 'string' && analysisModuleIds.includes(item as AnalysisModuleId),
  );
  const notifications = preferenceRecord(record.notifications);
  return {
    version: 1,
    language: record.language === 'en' ? 'en' : 'de',
    maskAmounts: typeof record.maskAmounts === 'boolean' ? record.maskAmounts : record.hideAmounts === true,
    analysisModules: [...new Set(selected)],
    chart: record.chart === 'ring' ? 'ring' : 'bar',
    custom: resolveCustomAppearance(record.custom),
    notifications: { payments: notifications?.payments !== false, imports: notifications?.imports !== false },
  };
}

/** Read without writing over missing, corrupt, future-version or inaccessible storage. */
export function loadWorkspacePreferences(storage: PreferenceReader): {
  value: WorkspacePreferences;
  status: PreferenceStorageState;
} {
  let serialized: string | null;
  try {
    serialized = storage.getItem(workspacePreferencesKey);
  } catch {
    return { value: defaultWorkspacePreferences(), status: 'unavailable' };
  }
  if (serialized === null) return { value: defaultWorkspacePreferences(), status: 'ready' };
  try {
    const record = preferenceRecord(JSON.parse(serialized));
    if (!record) return { value: defaultWorkspacePreferences(), status: 'invalid' };
    if (record.version !== undefined && record.version !== 0 && record.version !== 1)
      return { value: defaultWorkspacePreferences(), status: 'unsupported' };
    return {
      value: normalizeWorkspacePreferences(record),
      status:
        record.custom !== undefined && record.custom !== null && !resolveCustomAppearance(record.custom)
          ? 'invalid'
          : 'ready',
    };
  } catch {
    return { value: defaultWorkspacePreferences(), status: 'invalid' };
  }
}

/** Persist an allowlisted copy only; unvalidated custom styles and storage failure never report success. */
export function storeWorkspacePreferences(storage: PreferenceWriter, value: unknown): boolean {
  const record = preferenceRecord(value);
  if (
    !record ||
    record.version !== 1 ||
    (record.custom !== undefined && record.custom !== null && !resolveCustomAppearance(record.custom))
  )
    return false;
  if (record.language !== 'de' && record.language !== 'en') return false;
  try {
    storage.setItem(workspacePreferencesKey, JSON.stringify(normalizeWorkspacePreferences(record)));
    return true;
  } catch {
    return false;
  }
}

/** Restore only locale/privacy before first paint; never interpolate stored values into scripts or CSS. */
export function workspacePreferencesBootstrap() {
  return `(()=>{let p={};try{const v=JSON.parse(localStorage.getItem(${JSON.stringify(workspacePreferencesKey)})||'null');if(v&&typeof v==='object'&&!Array.isArray(v)&&(v.version===undefined||v.version===0||v.version===1))p=v;}catch{}const root=document.documentElement;root.lang=p.language==='en'?'en':'de';root.dataset.amountsMasked=String(typeof p.maskAmounts==='boolean'?p.maskAmounts:p.hideAmounts===true);})();`;
}
