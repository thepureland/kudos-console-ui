import { markRaw, type Component } from 'vue';

/**
 * Pluggable picker for a custom data-scope dimension such as region, brand, project, or warehouse.
 * The component follows Vue's modelValue/update:modelValue contract and receives role/tenant context.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export interface DataScopeDimensionPickerDefinition {
  dimension: string;
  component: Component;
  componentProps?: Record<string, unknown>;
}

const pickers = new Map<string, DataScopeDimensionPickerDefinition>();

export function registerDataScopeDimensionPicker(definition: DataScopeDimensionPickerDefinition): void {
  const dimension = definition.dimension.trim();
  if (!dimension) throw new Error('Data-scope dimension must not be blank');
  pickers.set(dimension, {
    ...definition,
    dimension,
    component: markRaw(definition.component),
  });
}

export function getDataScopeDimensionPicker(dimension: string): DataScopeDimensionPickerDefinition | undefined {
  return pickers.get(dimension);
}
