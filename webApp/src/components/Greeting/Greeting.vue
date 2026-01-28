<template>
  <div class="greeting-container">
    <el-button class="greeting-button" @click="handleClick">Click me!</el-button>

    <div
      v-if="isVisible"
      :class="['greeting-content', { 'fade-out': isAnimating }]"
      @animationend="handleAnimationEnd"
    >
      <JSLogo />
      <div>Vue: {{ greeting.greet() }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import JSLogo from '../JSLogo/JSLogo.vue';
import { Greeting as KotlinGreeting } from 'shared';
import './Greeting.css';

const greeting = new KotlinGreeting();
const isVisible = ref(false);
const isAnimating = ref(false);

const handleClick = () => {
  if (isVisible.value) {
    isAnimating.value = true;
  } else {
    isVisible.value = true;
  }
};

const handleAnimationEnd = (event: AnimationEvent) => {
  if (event.animationName === 'fadeOut') {
    isVisible.value = false;
    isAnimating.value = false;
  }
};
</script>
