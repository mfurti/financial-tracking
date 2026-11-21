import {
  defaultWorkspacePreferences,
  normalizeWorkspacePreferences,
  type PreferenceStorageState,
  type WorkspacePreferences,
} from '../utils/workspace-preferences';
import { resolveCustomAppearance } from '../utils/appearance';

/** Share validated device choices while keeping persistence failure distinct from usable local state. */
export function useWorkspacePreferences() {
  const preferences = useState<WorkspacePreferences>('workspace-preferences', defaultWorkspacePreferences);
  const storageState = useState<PreferenceStorageState>(
    'workspace-storage-state',
    /** Missing storage is usable until the client restore determines otherwise. */ () => 'ready',
  );
  /** Update only supported choices; the client plugin owns persistence and early document attributes. */
  function updatePreferences(patch: Partial<WorkspacePreferences>) {
    if (patch.custom !== undefined && patch.custom !== null && !resolveCustomAppearance(patch.custom)) return false;
    preferences.value = normalizeWorkspacePreferences({ ...preferences.value, ...patch });
    return true;
  }
  return { preferences, storageState, updatePreferences };
}
