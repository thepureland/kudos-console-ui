<template>
  <!-- Reusable fold-corner button: hover toggles temporary visibility; click toggles pinned visibility/hidden. -->
  <el-tooltip :content="visible ? hideText : showText" placement="left">
    <button
      class="table-corner-fold"
      :class="[{ 'is-active': visible }, positionClass]"
      type="button"
      :aria-label="visible ? hideText : showText"
      @mouseenter="$emit('fold-mouseenter')"
      @mouseleave="$emit('fold-mouseleave')"
      @focus="$emit('fold-mouseenter')"
      @blur="$emit('fold-mouseleave')"
      @click="$emit('toggle-pin')"
    />
  </el-tooltip>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'OperationColumnFoldToggle',
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    showText: {
      type: String,
      required: true,
    },
    hideText: {
      type: String,
      required: true,
    },
    position: {
      type: String as () => 'left' | 'right',
      default: 'right',
    },
  },
  emits: ['fold-mouseenter', 'fold-mouseleave', 'toggle-pin'],
  computed: {
    // Toggle between left/right sides via class; don't duplicate the template.
    positionClass(): string {
      return this.position === 'left' ? 'is-left' : 'is-right';
    },
  },
});
</script>

<style scoped>
.table-corner-fold {
  position: absolute;
  top: 0;
  z-index: 30;
  width: 18px;
  height: 18px;
  border: 0;
  padding: 0;
  cursor: pointer;
}

/* Top-right fold corner. */
.table-corner-fold.is-right {
  right: 0;
  background: linear-gradient(135deg, #f5f7fa 50%, #dcdfe6 50%);
  clip-path: polygon(100% 0, 0 0, 100% 100%);
}

/* Top-left fold corner. */
.table-corner-fold.is-left {
  left: 0;
  background: linear-gradient(225deg, #f5f7fa 50%, #dcdfe6 50%);
  clip-path: polygon(0 0, 100% 0, 0 100%);
}

.table-corner-fold.is-active {
  background: linear-gradient(135deg, #ecf5ff 50%, #409eff 50%);
}

.table-corner-fold.is-active.is-left {
  background: linear-gradient(225deg, #ecf5ff 50%, #409eff 50%);
}
</style>
