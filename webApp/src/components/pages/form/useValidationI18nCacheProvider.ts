import { provide, ref } from 'vue';
import { ValidationI18nCacheKey } from './useAddEditDialogSetup';

/**
 * Provide the validation-rule i18n cache in a list page's setup to avoid duplicated provide boilerplate.
 */
export function useValidationI18nCacheProvider(): void {
  provide(ValidationI18nCacheKey, ref(new Set<string>()));
}
