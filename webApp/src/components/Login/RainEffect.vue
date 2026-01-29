<!--
  作用：登录页“下雨+涟漪”视觉效果组件，仅负责生成雨滴/涟漪元素。
  说明：不包含登录表单逻辑，配合 RainEffect.css 使用。
  参考 https://blog.csdn.net/qq_35508835/article/details/116889827
  @author K
  @author AI: codex
  @since 1.0.0
-->

<template>
  <div ref="rainLayerRef" class="rain-layer" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import './RainEffect.css';

// 雨层容器引用（用于动态插入雨滴/涟漪）
const rainLayerRef = ref<HTMLElement | null>(null);

let rainTimer: number | undefined;
let rippleTimer: number | undefined;
let clientWidth = 0;
let clientHeight = 0;

// 读取当前视口尺寸
function updateViewport() {
  clientWidth = document.body.clientWidth;
  clientHeight = document.body.clientHeight;
}

// 生成单个雨滴（短生命周期）
function spawnRaindrop() {
  const layer = rainLayerRef.value;
  if (!layer || !clientWidth) return;
  const drop = document.createElement('div');
  drop.className = 'raindrop';
  drop.style.left = `${Math.floor(Math.random() * clientWidth)}px`;
  layer.appendChild(drop);
  window.setTimeout(() => {
    drop.remove();
  }, Math.floor(400 + Math.random() * 350));
}

// 生成单个涟漪（只在下半区）
function spawnRipple() {
  const layer = rainLayerRef.value;
  if (!layer || !clientWidth || !clientHeight) return;
  const ripple = document.createElement('div');
  ripple.className = 'ripple';
  ripple.style.left = `${Math.floor(Math.random() * clientWidth)}px`;
  ripple.style.top = `${Math.floor(clientHeight * 0.5 + Math.random() * (clientHeight * 0.5))}px`;
  layer.appendChild(ripple);
  window.setTimeout(() => {
    ripple.remove();
  }, 600);
}

// 启动雨滴与涟漪的循环生成
function startRain() {
  const loopDrops = () => {
    spawnRaindrop();
    rainTimer = window.setTimeout(loopDrops, Math.floor(10 + Math.random() * 10));
  };
  const loopRipples = () => {
    spawnRipple();
    rippleTimer = window.setTimeout(loopRipples, Math.floor(10 + Math.random() * 10));
  };
  loopDrops();
  loopRipples();
}

// 简单防抖，避免 resize 频繁触发
function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let timer: number | undefined;
  return (...args: Parameters<T>) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

onMounted(() => {
  updateViewport();
  startRain();
  // 监听窗口尺寸变化
  const onResize = debounce(updateViewport, 200);
  window.addEventListener('resize', onResize);
  (window as unknown as { __rainResize?: () => void }).__rainResize = onResize;
});

onBeforeUnmount(() => {
  if (rainTimer) window.clearTimeout(rainTimer);
  if (rippleTimer) window.clearTimeout(rippleTimer);
  // 卸载 resize 监听
  const stored = (window as unknown as { __rainResize?: () => void }).__rainResize;
  if (stored) window.removeEventListener('resize', stored);
});
</script>
