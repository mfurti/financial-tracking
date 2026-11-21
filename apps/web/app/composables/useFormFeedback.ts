import { formFieldErrors, userErrorMessage } from '../utils/api-error';

/** Attach public server validation paths to the page's existing Nuxt UI form. */
export function useFormFeedback() {
  const validation = ref<{
    setErrors: (errors: { name: string; message: string }[]) => void;
    getErrors?: () => { id?: string }[];
    clear?: (name: string) => void;
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
    return userErrorMessage(cause);
  }
  /** Focus the actual first invalid field after Nuxt UI has completed its validation render. */
  function formInvalid(event: { errors: readonly { id?: string }[] }) {
    pendingFocus.value = event.errors[0]?.id ?? '';
  }
  /** Discard feedback for an explicitly edited field without validating or submitting the new draft. */
  function clearFieldError(name: string) {
    validation.value?.clear?.(name);
  }
  return { validation, formError, formInvalid, clearFieldError };
}
