<script setup>
import { ref, computed } from 'vue'
import { useNovelStore } from '../stores/novel'
import { useSettingsStore } from '../stores/settings'
import { generateChapterDraft, finalizeChapter, enrichChapter, parseChapterBlueprint } from '../api/generator'
import { useMessage, useDialog, NButton, NInput, NProgress, NTag, NIcon, NTooltip, NSelect } from 'naive-ui'
import { WarningOutline, SparklesOutline, PencilOutline, SaveOutline, CheckmarkOutline, CheckmarkCircleOutline, ReloadOutline, HelpCircleOutline, DocumentTextOutline } from '@vicons/ionicons5'

const props = defineProps({
  project: Object,
  isGenerating: Boolean
})

const emit = defineEmits(['update:isGenerating'])
const novelStore = useNovelStore()
const settings = useSettingsStore()
const message = useMessage()
const dialog = useDialog()

// Current chapter being written - 当前正在写的章节
const currentChapter = ref(1)
const chapterContent = ref('')
const generationStep = ref('')

// Parsed blueprint chapters - 解析后的大纲章节
const blueprintChapters = computed(() => {
  if (!props.project?.chapterBlueprint) return []
  return parseChapterBlueprint(props.project.chapterBlueprint)
})

// Written chapters count - 已写章节数
const writtenChaptersCount = computed(() => {
  return Object.keys(props.project?.chapters || {}).length
})

// Next chapter to write - 下一个要写的章节
const nextChapterToWrite = computed(() => {
  const chapters = props.project?.chapters || {}
  for (let i = 1; i <= props.project?.numberOfChapters; i++) {
    if (!chapters[i]) return i
  }
  return props.project?.numberOfChapters || 1
})

// Current chapter info from blueprint - 当前章节大纲信息
const currentChapterInfo = computed(() => {
  return blueprintChapters.value.find(c => c.number === currentChapter.value) || null
})

// Check if chapter exists - 检查章节是否已存在
const chapterExists = computed(() => {
  return !!props.project?.chapters?.[currentChapter.value]
})

// Load chapter content when switching - 切换章节时加载内容
function loadChapter(num) {
  currentChapter.value = num
  chapterContent.value = props.project?.chapters?.[num] || ''
}

// Generate chapter draft - 生成章节草稿
async function handleGenerate() {
  if (!settings.apiConfig.apiKey) {
    message.warning('请先在设置中配置 API Key')
    return
  }

  if (!props.project?.blueprintGenerated) {
    message.warning('请先生成章节大纲')
    return
  }

  // Check if previous chapters exist for non-first chapters
  if (currentChapter.value > 1 && !props.project?.chapters?.[currentChapter.value - 1]) {
    const confirmed = await new Promise((resolve) => {
      dialog.warning({
        title: '提示',
        content: `第 ${currentChapter.value - 1} 章还未生成，建议先按顺序生成。是否继续？`,
        positiveText: '继续生成',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false)
      })
    })
    if (!confirmed) return
  }

  try {
    emit('update:isGenerating', true)
    
    // streaming callback
    const draft = await generateChapterDraft(
      props.project,
      currentChapter.value,
      settings.getStageConfig('chapter'),
      (step) => { generationStep.value = step },
      (content) => { chapterContent.value = content }
    )

    chapterContent.value = draft
    message.success(`第 ${currentChapter.value} 章草稿生成完成`)
  } catch (error) {
    console.error('Generation error:', error)
    message.error('生成失败: ' + error.message)
  } finally {
    emit('update:isGenerating', false)
    generationStep.value = ''
  }
}

// Enrich chapter - 扩写章节
async function handleEnrich() {
  if (!chapterContent.value) return

  try {
    emit('update:isGenerating', true)
    
    const enriched = await enrichChapter(
      chapterContent.value,
      settings.getStageConfig('enrich'),
      (step) => { generationStep.value = step },
      (content) => { chapterContent.value = content }
    )

    chapterContent.value = enriched
    message.success('章节扩写完成')
  } catch (error) {
    message.error('扩写失败: ' + error.message)
  } finally {
    emit('update:isGenerating', false)
    generationStep.value = ''
  }
}

// Save chapter only - 仅保存章节
function handleQuickSave() {
  if (!chapterContent.value.trim()) {
    message.warning('内容为空')
    return
  }
  
  const chapters = { ...props.project.chapters }
  chapters[currentChapter.value] = chapterContent.value
  
  novelStore.updateProject(props.project.id, { chapters })
  message.success('已保存')
}

// Save and finalize - 保存并定稿
async function handleSaveAndFinalize() {
  if (!chapterContent.value.trim()) {
    message.warning('内容为空')
    return
  }

  try {
    emit('update:isGenerating', true)
    generationStep.value = '正在更新章节摘要和角色状态...'

    const results = await finalizeChapter(
      props.project,
      currentChapter.value,
      chapterContent.value,
      settings.getStageConfig('chapter'), // using chapter config for finalization too
      (step) => { generationStep.value = step }
    )

    // Update project with new data
    novelStore.updateProject(props.project.id, {
      chapters: {
        ...props.project.chapters,
        [currentChapter.value]: chapterContent.value
      },
      ...results
    })

    message.success('章节已定稿，上下文已更新')
    
    // Auto move to next chapter if available
    if (currentChapter.value < props.project.numberOfChapters) {
      const next = currentChapter.value + 1
      loadChapter(next)
    }
  } catch (error) {
    console.error('Finalize error:', error)
    message.error('定稿失败: ' + error.message)
  } finally {
    emit('update:isGenerating', false)
    generationStep.value = ''
  }
}

// Initialize with next chapter to write - 初始化到下一个要写的章节
loadChapter(nextChapterToWrite.value)
</script>

<template>
  <div class="space-y-4">
    <!-- Not ready state - 未就绪状态 -->
    <div 
      v-if="!project?.blueprintGenerated" 
      class="bg-white dark:bg-[#1f1f23] rounded-2xl p-6 md:p-12 border border-gray-200/80 dark:border-gray-700/50 text-center"
    >
      <div class="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/25">
        <WarningOutline class="w-12 h-12 text-white" />
      </div>
      <h3 class="text-2xl font-bold text-gray-800 dark:text-white mb-3">请先生成章节大纲</h3>
      <p class="text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
        章节正文的生成需要基于章节大纲
      </p>
    </div>

    <!-- Main content - 主内容 -->
    <div v-else class="h-full flex flex-col gap-4">
      <!-- Toolbar - 工具栏 -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#1f1f23] p-4 rounded-xl border border-gray-200/80 dark:border-gray-700/50">
        <div class="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          <!-- Progress indicator - 进度指示 -->
          <div class="flex-shrink-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-gray-600 dark:text-gray-400">进度</span>
              <span class="text-xs font-bold text-gray-800 dark:text-white">
                {{ writtenChaptersCount }}/{{ project.numberOfChapters }}
              </span>
            </div>
            <n-progress 
              type="line"
              :percentage="project.numberOfChapters > 0 ? Math.round((writtenChaptersCount / project.numberOfChapters) * 100) : 0"
              :height="6"
              :border-radius="4"
              :fill-border-radius="4"
              :show-indicator="false"
              class="w-24"
            />
          </div>

          <!-- Chapter selector - 章节选择器 -->
          <div class="flex-shrink-0">
            <n-select
              v-model:value="currentChapter"
              :options="blueprintChapters.map(c => ({ label: `第${c.number}章 ${c.title}`, value: c.number }))"
              placeholder="选择章节"
              class="w-40"
              size="small"
              @update:value="loadChapter"
            />
          </div>

          <!-- Chapter info header - 章节信息头部 -->
          <div class="flex-1 min-w-[120px]">
             <div class="flex flex-col gap-1">
               <div class="flex items-center gap-2">
                 <h3 class="text-sm font-bold text-gray-800 dark:text-white truncate max-w-[150px]">
                   {{ currentChapterInfo?.title || '未命名' }}
                 </h3>
                 <n-tag v-if="chapterExists" type="success" size="small" :bordered="false" round>已保存</n-tag>
                 <n-tag v-else type="info" size="small" :bordered="false" round>未保存</n-tag>
               </div>
             </div>
          </div>
        </div>

        <!-- Action buttons - 操作按钮 -->
        <div class="flex flex-wrap gap-2 md:ml-auto">
          <n-button type="primary" :loading="isGenerating" @click="handleGenerate" size="small">
            <template #icon>
              <n-icon><SparklesOutline /></n-icon>
            </template>
            生成
          </n-button>
          <n-button :disabled="isGenerating || !chapterContent" @click="handleEnrich" secondary size="small">
            <template #icon>
              <n-icon><PencilOutline /></n-icon>
            </template>
            扩写
          </n-button>
          <n-button 
            v-if="!isGenerating"
            secondary 
            type="error"
            size="small"
            class="!px-3"
            @click="handleQuickSave"
          >
            <template #icon>
              <n-icon><SaveOutline /></n-icon>
            </template>
            保存
          </n-button>
          
          <n-button type="success" :loading="isGenerating" :disabled="!chapterContent" @click="handleSaveAndFinalize" size="small">
            <template #icon>
              <n-icon><CheckmarkOutline /></n-icon>
            </template>
            定稿
          </n-button>
        </div>
      </div>

      <!-- Main Editor Area -->
      <div class="flex-1 space-y-4">
        <!-- Global Summary - 前文摘要 -->
        <div 
          v-if="currentChapter > 1 && project.globalSummary" 
          class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl p-3 border border-amber-200/50 dark:border-amber-700/30"
        >
          <div class="flex items-center gap-2 mb-1">
            <DocumentTextOutline class="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span class="text-xs font-medium text-amber-700 dark:text-amber-300">前文摘要</span>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
            {{ project.globalSummary }}
          </p>
        </div>

        <!-- Generation status - 生成状态 -->
        <div v-if="isGenerating" class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-3 border border-indigo-200/50 dark:border-indigo-700/50">
          <div class="flex items-center gap-2">
            <ReloadOutline class="w-4 h-4 text-indigo-500 animate-spin" />
            <span class="text-indigo-700 dark:text-indigo-300 text-sm font-medium">{{ generationStep || '处理中...' }}</span>
          </div>
        </div>

        <!-- Editor textarea - 编辑器文本框 -->
        <div class="bg-white dark:bg-[#1f1f23] rounded-xl border border-gray-200/80 dark:border-gray-700/50 p-4">
           <!-- Meta Tags -->
           <div v-if="currentChapterInfo" class="flex flex-wrap gap-2 text-xs mb-3 pb-3 border-b border-gray-100 dark:border-gray-700/50">
              <span class="text-gray-400">本章目标:</span>
              <n-tag size="tiny" type="success" :bordered="false" round>{{ currentChapterInfo.purpose }}</n-tag>
              <n-tag size="tiny" type="warning" :bordered="false" round>{{ currentChapterInfo.suspense }}</n-tag>
              <div v-if="currentChapterInfo.summary" class="w-full mt-1 text-gray-500 italic">
                {{ currentChapterInfo.summary }}
              </div>
           </div>

           <n-input
             v-model:value="chapterContent"
             type="textarea"
             :autosize="{ minRows: 15, maxRows: 30 }"
             :placeholder="`在此编写或生成第 ${currentChapter} 章内容...`"
             class="novel-textarea !border-0 !bg-transparent !p-0"
           />
           
           <!-- Word count -->
           <div class="text-right text-xs text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700/50 pt-2">
             {{ chapterContent ? chapterContent.length : 0 }} 字
           </div>
        </div>
      </div>
    </div>
  </div>
</template>
