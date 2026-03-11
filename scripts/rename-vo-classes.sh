#!/usr/bin/env bash
# kudos-ms 下 *-common/vo 包中 VO 类重命名并更新引用。用法: ./rename-vo-classes.sh /Users/will/dev/code/kudos
set -e
ROOT="${1:?usage: $0 <kudos-repo-root>}"
cd "$ROOT"
MS="$ROOT/kudos-ms"

replace_in_all_kt() {
  local from="$1" to="$2"
  find "$MS" -name "*.kt" -print0 2>/dev/null | xargs -0 grep -l "$from" 2>/dev/null | while IFS= read -r kt; do
    sed -i '' "s/${from}/${to}/g" "$kt"
  done
}

# ---- 1) Record -> Row (仅 VO 类名，先改 vo 文件再全量替换) ----
records="SysTenantRecord SysMicroServiceRecord SysDomainRecord SysDataSourceRecord SysParamRecord SysSystemRecord SysI18nRecord SysResourceRecord SysDictItemRecord SysDictItemTreeRecord SysDictRecord MsgSendRecord MsgInstanceRecord MsgReceiveRecord MsgReceiverGroupRecord MsgTemplateRecord AuthGroupRecord AuthRoleRecord UserAccountProtectionRecord UserAccountThirdRecord UserAccountRecord UserOrgTreeRecord UserLoginRememberMeRecord UserContactWayRecord SysAccessRuleIpRecord SysResourceTreeRecord SysAccessRuleRecord SysCacheRecord"
for name in $records; do
  row="${name%Record}Row"
  f=$(find "$MS" -path "*/vo/*" -name "${name}.kt" 2>/dev/null | head -1)
  [ -n "$f" ] && [ -f "$f" ] || continue
  sed -i '' "s/${name}/${row}/g" "$f"
  mv "$f" "$(dirname "$f")/${row}.kt"
done
for name in $records; do
  replace_in_all_kt "$name" "${name%Record}Row"
done

# ---- 2) SearchPayload -> Query ----
searchpayloads="SysTenantSearchPayload SysSystemSearchPayload SysCacheSearchPayload SysResourceSearchPayload SysDataSourceSearchPayload SysDomainSearchPayload SysMicroServiceSearchPayload SysDictSearchPayload SysI18nSearchPayload SysParamSearchPayload MsgSendSearchPayload MsgReceiveSearchPayload SysDictItemSearchPayload MsgReceiverGroupSearchPayload UserContactWaySearchPayload UserAccountThirdSearchPayload MsgInstanceSearchPayload UserLoginRememberMeSearchPayload UserAccountProtectionSearchPayload AuthRoleSearchPayload MsgTemplateSearchPayload AuthGroupSearchPayload UserAccountSearchPayload SysAccessRuleIpSearchPayload SysAccessRuleSearchPayload"
for name in $searchpayloads; do
  query="${name%SearchPayload}Query"
  f=$(find "$MS" -path "*/vo/*" -name "${name}.kt" 2>/dev/null | head -1)
  [ -n "$f" ] && [ -f "$f" ] || continue
  sed -i '' "s/${name}/${query}/g" "$f"
  mv "$f" "$(dirname "$f")/${query}.kt"
done
for name in $searchpayloads; do
  replace_in_all_kt "$name" "${name%SearchPayload}Query"
done

# ---- 3) Payload -> Form（排除 SearchPayload 与 base 的 FormPayload/ListSearchPayload） ----
payloads="SysTenantPayload SysSystemPayload SysMicroServicePayload SysDictPayload SysCachePayload SysDataSourcePayload SysDomainPayload SysParamPayload SysResourcePayload SysAccessRulePayload SysAccessRuleIpPayload SysDictItemPayload SysI18nPayload SysI18nBatchPayload MsgSendPayload MsgInstancePayload MsgReceivePayload MsgReceiverGroupPayload MsgTemplatePayload"
for name in $payloads; do
  form="${name%Payload}Form"
  f=$(find "$MS" -path "*/vo/*" -name "${name}.kt" 2>/dev/null | head -1)
  [ -n "$f" ] && [ -f "$f" ] || continue
  sed -i '' "s/${name}/${form}/g" "$f"
  mv "$f" "$(dirname "$f")/${form}.kt"
done
for name in $payloads; do
  replace_in_all_kt "$name" "${name%Payload}Form"
done

# ---- 4) CacheItem -> CacheEntry ----
cacheitems="SysTenantSystemCacheItem SysTenantCacheItem SysMicroServiceCacheItem SysAccessRuleCacheItem SysDataSourceCacheItem SysDomainCacheItem SysParamCacheItem SysSystemCacheItem SysI18nCacheItem SysDictCacheItem SysAccessRuleIpCacheItem SysResourceCacheItem SysDictItemCacheItem SysCacheCacheItem MsgSendCacheItem MsgInstanceCacheItem MsgReceiveCacheItem MsgReceiverGroupCacheItem MsgTemplateCacheItem AuthGroupCacheItem AuthRoleCacheItem UserAccountProtectionCacheItem UserAccountThirdCacheItem UserAccountCacheItem UserOrgCacheItem UserLoginRememberMeCacheItem UserContactWayCacheItem"
for name in $cacheitems; do
  entry="${name%CacheItem}CacheEntry"
  f=$(find "$MS" -path "*/vo/*" -name "${name}.kt" 2>/dev/null | head -1)
  [ -n "$f" ] && [ -f "$f" ] || continue
  sed -i '' "s/${name}/${entry}/g" "$f"
  mv "$f" "$(dirname "$f")/${entry}.kt"
done
for name in $cacheitems; do
  replace_in_all_kt "$name" "${name%CacheItem}CacheEntry"
done

echo "VO rename done."
