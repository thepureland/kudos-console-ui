<!--
  Purpose: visual "rain + ripple" effect component for the login page; only responsible for generating raindrop/ripple elements.
  Notes: contains no login form logic; used together with RainEffect.css.
  Reference: https://blog.csdn.net/qq_35508835/article/details/116889827
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

// Rain-layer container ref (used to dynamically insert raindrops/ripples).
const rainLayerRef = ref<HTMLElement | null>(null);

let rainTimer: number | undefined;
let rippleTimer: number | undefined;
let clientWidth = 0;
let clientHeight = 0;

// Read the current viewport size.
function updateViewport() {
  clientWidth = document.body.clientWidth;
  clientHeight = document.body.clientHeight;
}

// Spawn a single raindrop (short-lived).
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

// Spawn a single ripple (only in the lower half).
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

// Start the loop that generates raindrops and ripples.
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

// Simple debounce to avoid resize firing too frequently.
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
  // Listen for window size changes.
  const onResize = debounce(updateViewport, 200);
  window.addEventListener('resize', onResize);
  (window as unknown as { __rainResize?: () => void }).__rainResize = onResize;
});

onBeforeUnmount(() => {
  if (rainTimer) window.clearTimeout(rainTimer);
  if (rippleTimer) window.clearTimeout(rippleTimer);
  // Detach the resize listener.
  const stored = (window as unknown as { __rainResize?: () => void }).__rainResize;
  if (stored) window.removeEventListener('resize', stored);
});
</script>
