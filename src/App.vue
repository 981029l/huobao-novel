<script setup>
import { computed } from 'vue'
import { useSettingsStore } from './stores/settings'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import AppHeader from './components/AppHeader.vue'

import { useNovelStore } from './stores/novel'
import { onMounted } from 'vue'

const settings = useSettingsStore()
const novelStore = useNovelStore()

onMounted(() => {
  novelStore.init()
})

const theme = computed(() => settings.isDark ? darkTheme : null)
</script>

<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-dialog-provider>
        <div class="min-h-screen bg-gray-50 dark:bg-[#18181c] transition-colors">
          <!-- Header - 顶部导航栏 -->
          <AppHeader />
          
          <!-- Main content - 主内容区 -->
          <main class="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-8">
            <router-view />
          </main>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
/* Global styles - 全局样式 */
html {
  scroll-behavior: smooth;
}
</style>
