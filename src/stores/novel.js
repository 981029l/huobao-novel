import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage } from '../utils/storage'

// Novel project store - 小说项目状态管理
export const useNovelStore = defineStore('novel', () => {
  // State
  const projects = ref([]) // Initialize empty
  const currentProject = ref(null)
  const isGenerating = ref(false)
  const generationProgress = ref('')
  const isLoaded = ref(false) // New state to track loading

  // Getters
  const projectList = computed(() => projects.value)
  const hasProjects = computed(() => projects.value.length > 0)

  // Actions
  // Initialize store - 初始化
  async function init() {
    if (isLoaded.value) return

    // Try to migrate or load from storage
    const storedProjects = await storage.migrateFromLocalStorage('novel_projects') || []
    projects.value = storedProjects
    isLoaded.value = true

    // If current project was selected but refresh happened, try to restore it?
    // For now we just load the list.
  }

  // Create a new novel project - 创建新小说项目
  async function createProject(projectData) {
    const newProject = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...projectData,
      // Architecture data - 架构数据
      coreSeed: '',
      characterDynamics: '',
      worldBuilding: '',
      plotArchitecture: '',
      characterState: '',
      // Chapter blueprint - 章节大纲
      chapterBlueprint: '',
      // Chapters content (key: chapter number, value: chapter text) - 章节内容
      chapters: {},
      // Global summary - 前文摘要
      globalSummary: '',
      // Generation status - 生成状态
      architectureGenerated: false,
      blueprintGenerated: false
    }
    projects.value.unshift(newProject)
    await saveToStorage()
    return newProject
  }

  // Update project - 更新项目
  async function updateProject(id, updates) {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = {
        ...projects.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      await saveToStorage()
      if (currentProject.value?.id === id) {
        currentProject.value = projects.value[index]
      }
    }
  }

  // Delete project - 删除项目
  async function deleteProject(id) {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value.splice(index, 1)
      await saveToStorage()
      if (currentProject.value?.id === id) {
        currentProject.value = null
      }
    }
  }

  // Set current project - 设置当前项目
  function setCurrentProject(id) {
    currentProject.value = projects.value.find(p => p.id === id) || null
  }

  // Save to storage - 保存到存储
  async function saveToStorage() {
    // IMPORTANT: Strip Vue proxies to ensure clean data is saved to IndexedDB
    const rawData = JSON.parse(JSON.stringify(projects.value))
    await storage.setItem('novel_projects', rawData)
  }

  // Set generation state - 设置生成状态
  function setGenerating(value, progress = '') {
    isGenerating.value = value
    generationProgress.value = progress
  }

  return {
    projects,
    currentProject,
    isGenerating,
    generationProgress,
    projectList,
    hasProjects,
    isLoaded,
    init,
    createProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    setGenerating
  }
})
