import { provide, ref } from 'vue';
import { ValidationI18nCacheKey } from './useAddEditDialogSetup';

/**
 * 在列表页 setup 中提供校验规则 i18n 缓存，避免重复写 provide 样板代码。
 */
export function useValidationI18nCacheProvider(): void {
  provide(ValidationI18nCacheKey, ref(new Set<string>()));
}
