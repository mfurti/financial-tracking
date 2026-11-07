import { z } from 'zod';
import { formFieldErrors } from '../utils/api-error';

/** Attach public server validation paths to the page's existing Nuxt UI form. */
export function useFormFeedback() {
  const validation = ref<{
    setErrors: (errors: { name: string; message: string }[]) => void;
    getErrors?: () => { id?: string }[];
    disabled?: boolean;
  } | null>(null);
  const pendingFocus = ref('');
  watchPostEffect(
    /** Focus only after Nuxt UI has re-enabled controls following submission. */ () => {
      if (!pendingFocus.value || validation.value?.disabled) return;
      document.getElementById(pendingFocus.value)?.focus();
      pendingFocus.value = '';
    },
  );
  /** Retain typed drafts and return a safe alert message while marking affected controls. */
  function formError(cause: unknown) {
    validation.value?.setErrors(formFieldErrors(cause));
    pendingFocus.value = validation.value?.getErrors?.()[0]?.id ?? '';
    return cause instanceof z.ZodError
      ? 'Bitte markierte Eingaben prüfen.'
      : cause instanceof Error
        ? cause.message
        : 'Anfrage fehlgeschlagen. Bitte erneut versuchen.';
  }
  return { validation, formError };
}
