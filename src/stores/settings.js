import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { fetchModels } from '../api/llm'

// Default model config - 默认模型配置
const DEFAULT_MODEL = 'gemini-3-flash-preview'

// Settings store - 设置状态管理
export const useSettingsStore = defineStore('settings', () => {
  // State
  const isDark = ref(localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches))

  const apiConfig = ref(JSON.parse(localStorage.getItem('api_config') || JSON.stringify({
    channel: 'chatfire',
    baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://api.chatfire.site/v1',
    apiKey: import.meta.env.VITE_AI_API_KEY || '',
    model: import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL,
    temperature: 0.7,
    maxTokens: 8192,
    timeout: 600
  })))

  // Stage-specific model configs - 各环节模型配置
  const stageModels = ref(JSON.parse(localStorage.getItem('stage_models') || JSON.stringify({
    architecture: '',  // 架构生成
    blueprint: '',     // 大纲生成
    chapter: '',       // 章节生成
    finalize: '',      // 定稿（摘要/状态更新）
    enrich: ''         // 扩写
  })))

  // Fetched models from API - 从 API 获取的模型列表
  const fetchedModels = ref([])

  // Get config for specific stage - 获取特定环节的配置
  function getStageConfig(stage) {
    const stageModel = stageModels.value[stage]
    if (stageModel) {
      return { ...apiConfig.value, model: stageModel }
    }
    return apiConfig.value
  }

  // Watch theme changes and apply - 监听主题变化并应用
  watch(isDark, (newValue) => {
    if (newValue) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, { immediate: true })

  // Actions
  // Toggle dark mode - 切换深色模式
  function toggleDark() {
    isDark.value = !isDark.value
  }

  // Update API config - 更新 API 配置
  function updateApiConfig(config) {
    apiConfig.value = { ...apiConfig.value, ...config }
    localStorage.setItem('api_config', JSON.stringify(apiConfig.value))
  }

  // Update stage models - 更新环节模型配置
  function updateStageModels(models) {
    stageModels.value = { ...stageModels.value, ...models }
    localStorage.setItem('stage_models', JSON.stringify(stageModels.value))
  }

  // Fetch available models - 获取可用模型
  async function fetchAvailableModels(config = apiConfig.value) {
    try {
      const models = await fetchModels(config)
      fetchedModels.value = models.map(m => m.id)
      return fetchedModels.value
    } catch (error) {
      console.error('Failed to fetch models:', error)
      throw error
    }
  }

  return {
    isDark,
    apiConfig,
    stageModels,
    fetchedModels,
    toggleDark,
    updateApiConfig,
    updateStageModels,
    getStageConfig,
    fetchAvailableModels
  }
})
