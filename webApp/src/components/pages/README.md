# Pages Abstraction Guide

本目录提供 `ListPage` / `FormPage` / `DetailPage` 的统一抽象与可复用 hook。  
新增页面时，建议优先复用这些能力，避免回到“每页手写样板”。

## Directory Entry Points

为降低一次性迁移风险，当前采用“分组入口 + 渐进迁移”的方式：

- `core/`
  - 基类与核心类型（`Base*Page`、`DictService`、`*PageTypes`）
- `form/`
  - Add/Edit 相关 props、setup、close guard、表单工具
- `list/`
  - List 页布局、列可见性、列拖拽、自动列宽、固定列重排
- `detail/`
  - Detail 通用 props、rid 同步、visible/close、section 组装
- `support/`
  - 业务支持基类（`TenantSupport*`、`OrgSupport*`）
- `integration/`
  - 外部集成相关 hook（如微服务树、分栏拖拽）
- `ui/`
  - 公共页面级组件入口（当前含 `ListPageLayout`）
- `index.ts`
  - 顶层聚合导出（可作为新代码的统一引入入口）

建议新代码优先通过上述分组入口引入；旧路径可逐步迁移，无需一次性改完。

## Shared Types

- `pageTypes.ts`
  - `PageProps`
  - `PageContext`
- `addEditDialogTypes.ts`
  - `AddEditDialogProps` / `AddEditDialogContext`（基于 `Page*`）
- `listPageTypes.ts`
  - `ListPageProps` / `ListPageContext`（基于 `Page*`）

## FormPage Pattern

优先使用：

- `addEditDialogProps.ts`
  - `commonAddEditDialogProps`
  - `commonAddEditDialogEmits`
- `useAddEditDialogSetupWithVisible.ts`
  - 统一 `useAddEditDialogSetup` + `visible` 生命周期触发
- `formHasContent.ts`
  - `hasAnyFormContent(...)`
- 可选：
  - `useCloseDropdownOnChange.ts`
  - `useOnDialogVisible.ts`（一般由 `useAddEditDialogSetupWithVisible` 内部处理）

建议模板（简化示意）：

```ts
export default defineComponent({
  props: { ...commonAddEditDialogProps },
  emits: commonAddEditDialogEmits,
  setup(props: AddEditDialogProps, context: AddEditDialogContext) {
    return useAddEditDialogSetupWithVisible(props, context, {
      createPage: (p, c) => new XxxFormPage(p, c),
      i18nKeyPrefix: 'xxxAddEdit',
      formHasContent(model) {
        return hasAnyFormContent(model, {
          stringKeys: ['name', 'remark'],
          arrayKeys: ['parent'],
          valueKeys: ['seqNo'],
        });
      },
      onVisible: async (result) => {
        // 页面可见后才执行的加载逻辑（可选）
      },
    });
  },
});
```

## ListPage Pattern

常用组合：

- `useListPageLayout.ts`
- `useListPageVisibilityState.ts`
- `useFixedLeftRelayoutWatcher.ts`
- `useListPageFormSetup.ts`
- `useTableAutoWidthContext.ts`
- `createI18nColumnLabelGetter.ts`
- `createColumnVisibilityConfig.ts`

列标题建议统一：

```ts
const columnLabel = createI18nColumnLabelGetter(t, 'xxxList.columns', {
  subSystemCode: 'subSys',
});
```

并复用在：

- `columnVisibilityOptions.getColumnLabel`
- `autoWidthColumns.getLabel`

## DetailPage Pattern

- `setup` 参数统一使用 `PageProps` / `PageContext`
- 详情弹窗只保留业务逻辑，公共行为交给 `BaseDetailPage` 与公共 hook

## Cleanup Rules

保持页面轻量，避免回归样板代码：

- 不保留空 `components: {}`
- 不保留空 `<style scoped></style>`
- 不保留仅 `super.xxx()` 的空覆盖方法
