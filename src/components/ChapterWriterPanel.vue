<script setup>
import { ref, computed } from 'vue'
import { useNovelStore } from '../stores/novel'
import { useSettingsStore } from '../stores/settings'
import { generateChapterDraft, finalizeChapter, enrichChapter, parseChapterBlueprint, checkChapterQuality, fixChapterByQuality } from '../api/generator'
import { useMessage, useDialog, NButton, NInput, NProgress, NTag, NIcon, NTooltip, NSelect } from 'naive-ui'
import { WarningOutline, SparklesOutline, PencilOutline, SaveOutline, CheckmarkOutline, CheckmarkCircleOutline, ReloadOutline, HelpCircleOutline, DocumentTextOutline, CopyOutline } from '@vicons/ionicons5'

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
const isFinalizing = ref(false) // 防抖锁：防止定稿按钮重复点击
const qualityCheckResult = ref(null) // 质检结果
const isChecking = ref(false) // 是否正在质检

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

// Current chapter display name - 当前章节显示名
const currentChapterName = computed(() => {
  const title = currentChapterInfo.value?.title?.trim() || '未命名'
  return `第${currentChapter.value}章 ${title}`
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

    // 自动质检
    qualityCheckResult.value = null
    isChecking.value = true
    generationStep.value = '正在进行质检...'
    try {
      const chapterInfo = blueprintChapters.value.find(c => c.number === currentChapter.value)
      const nextChapterInfo = blueprintChapters.value.find(c => c.number === currentChapter.value + 1)
      const result = await checkChapterQuality({
        chapterText: draft,
        chapterNumber: currentChapter.value,
        chapterTitle: chapterInfo?.title || `第${currentChapter.value}章`,
        chapterSummary: chapterInfo?.summary || '',
        wordNumber: props.project?.wordNumber || 3000,
        actualWordCount: draft.length,
        nextChapterNumber: currentChapter.value + 1,
        nextChapterTitle: nextChapterInfo?.title || '',
        nextChapterSummary: nextChapterInfo?.summary || ''
      }, settings.getStageConfig('finalize'))
      qualityCheckResult.value = result
      if (result.overallPass) {
        message.success('质检通过 ✓')
      } else {
        message.warning('质检发现问题，请检查')
      }
    } catch (err) {
      console.warn('质检失败:', err)
    } finally {
      isChecking.value = false
    }
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

// Fix chapter by quality check - 根据质检结果修复章节
async function handleFix() {
  if (!chapterContent.value || !qualityCheckResult.value) return

  try {
    emit('update:isGenerating', true)
    
    const chapterInfo = blueprintChapters.value.find(c => c.number === currentChapter.value)
    const nextChapterInfo = blueprintChapters.value.find(c => c.number === currentChapter.value + 1)

    const fixed = await fixChapterByQuality({
      chapterText: chapterContent.value,
      chapterNumber: currentChapter.value,
      chapterTitle: chapterInfo?.title || `第${currentChapter.value}章`,
      chapterSummary: chapterInfo?.summary || '',
      wordNumber: props.project?.wordNumber || 2000,
      nextChapterNumber: currentChapter.value + 1,
      nextChapterTitle: nextChapterInfo?.title || '',
      qualityResult: qualityCheckResult.value
    },
    settings.getStageConfig('chapter'),
    (step) => { generationStep.value = step },
    (content) => { chapterContent.value = content })

    chapterContent.value = fixed
    message.success('章节修复完成')

    // 重新质检
    qualityCheckResult.value = null
    isChecking.value = true
    generationStep.value = '正在重新质检...'
    try {
      const result = await checkChapterQuality({
        chapterText: fixed,
        chapterNumber: currentChapter.value,
        chapterTitle: chapterInfo?.title || `第${currentChapter.value}章`,
        chapterSummary: chapterInfo?.summary || '',
        wordNumber: props.project?.wordNumber || 3000,
        actualWordCount: fixed.length,
        nextChapterNumber: currentChapter.value + 1,
        nextChapterTitle: nextChapterInfo?.title || '',
        nextChapterSummary: nextChapterInfo?.summary || ''
      }, settings.getStageConfig('finalize'))
      qualityCheckResult.value = result
      if (result.overallPass) {
        message.success('修复后质检通过 ✓')
      } else {
        message.warning('仍有问题，可再次修复')
      }
    } catch (err) {
      console.warn('重新质检失败:', err)
    } finally {
      isChecking.value = false
    }
  } catch (error) {
    message.error('修复失败: ' + error.message)
  } finally {
    emit('update:isGenerating', false)
    generationStep.value = ''
  }
}

// Copy content - 复制内容
// 兼容HTTP的复制方法（Clipboard API仅HTTPS可用）
function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback: 创建临时textarea
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    return Promise.resolve()
  } catch (err) {
    return Promise.reject(err)
  } finally {
    document.body.removeChild(textarea)
  }
}

function handleCopy() {
  if (!chapterContent.value) {
    message.warning('内容为空')
    return
  }
  copyToClipboard(chapterContent.value)
    .then(() => message.success('已复制到剪贴板'))
    .catch(() => message.error('复制失败'))
}

// Copy chapter name - 复制章节名
async function handleCopyChapterName() {
  try {
    await copyToClipboard(currentChapterName.value)
    message.success('章节名已复制')
  } catch (error) {
    message.error('复制失败，请稍后重试')
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
  // 防抖锁：如果正在定稿中，直接返回
  if (isFinalizing.value) {
    console.log('定稿已在进行中，忽略重复点击')
    return
  }
  
  if (!chapterContent.value.trim()) {
    message.warning('内容为空')
    return
  }

  try {
    isFinalizing.value = true // 加锁
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
    isFinalizing.value = false // 释放锁
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
      <!-- Desktop Toolbar (Hidden on Mobile) -->
      <div class="hidden md:flex md:items-center justify-between gap-4 bg-white dark:bg-[#1f1f23] p-4 rounded-xl border border-gray-200/80 dark:border-gray-700/50">
        <div class="flex items-center gap-3 w-full md:w-auto">
          <!-- Progress indicator -->
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

          <!-- Chapter selector -->
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

          <!-- Chapter info header -->
          <div class="flex-1 min-w-[120px]">
             <div class="flex flex-col gap-1">
               <div class="flex items-center gap-2">
                 <h3 class="text-sm font-bold text-gray-800 dark:text-white truncate max-w-[150px]">
                   {{ currentChapterInfo?.title || '未命名' }}
                 </h3>
                 <button
                   type="button"
                   @click="handleCopyChapterName"
                   class="btn-unified inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
                 >
                   <CopyOutline class="w-3.5 h-3.5" />
                   复制章节名
                 </button>
                 <n-tag v-if="chapterExists" type="success" size="small" :bordered="false" round>已保存</n-tag>
                 <n-tag v-else type="info" size="small" :bordered="false" round>未保存</n-tag>
               </div>
             </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-wrap gap-2 ml-auto">
          <n-button type="primary" :loading="isGenerating" @click="handleGenerate" size="small">
            <template #icon><n-icon><SparklesOutline /></n-icon></template>
            生成
          </n-button>
          <n-button :disabled="isGenerating || !chapterContent" @click="handleEnrich" secondary size="small">
            <template #icon><n-icon><PencilOutline /></n-icon></template>
            扩写
          </n-button>
          <n-button v-if="!isGenerating" secondary size="small" class="!px-3" @click="handleCopy">
            <template #icon><n-icon><CopyOutline /></n-icon></template>
            复制
          </n-button>
          <n-button v-if="!isGenerating" secondary type="error" size="small" class="!px-3" @click="handleQuickSave">
            <template #icon><n-icon><SaveOutline /></n-icon></template>
            保存
          </n-button>
          <n-button type="success" :loading="isGenerating" :disabled="!chapterContent" @click="handleSaveAndFinalize" size="small">
            <template #icon><n-icon><CheckmarkOutline /></n-icon></template>
            定稿
          </n-button>
        </div>
      </div>

      <!-- Mobile Toolbar (Modern Style) -->
      <div class="md:hidden flex flex-col gap-3 mobile-toolbar-sticky">
        <!-- Top Control Bar (Navigation) -->
        <div class="bg-white dark:bg-[#1f1f23] p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span class="text-xs font-medium">{{ writtenChaptersCount }}/{{ project.numberOfChapters }} 已完成</span>
            </div>
            <n-tag
              v-if="chapterExists"
              type="success"
              :bordered="false"
              size="small"
              round
              class="!h-6 !px-2.5"
            >
              已存
            </n-tag>
            <n-tag
              v-else
              type="default"
              :bordered="false"
              size="small"
              round
              class="!h-6 !px-2.5"
            >
              未存
            </n-tag>
          </div>

          <div class="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-gray-50/90 dark:bg-gray-800/40 p-2.5">
            <div class="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              <DocumentTextOutline class="w-3.5 h-3.5" />
              当前章节
            </div>
            <n-select
              v-model:value="currentChapter"
              :options="blueprintChapters.map(c => ({ label: `第${c.number}章 ${c.title}`, value: c.number }))"
              placeholder="选择章节"
              class="w-full"
              size="small"
              @update:value="loadChapter"
            />

            <div class="mt-2.5 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">章节名</div>
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {{ currentChapterName }}
                </div>
              </div>
              <button
                type="button"
                @click="handleCopyChapterName"
                class="btn-unified shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 transition-colors"
              >
                <CopyOutline class="w-3.5 h-3.5" />
                复制章节名
              </button>
            </div>
          </div>
        </div>

        <!-- Action Bar (Modern Icon Bar) -->
        <div class="bg-white/90 dark:bg-[#1f1f23]/90 backdrop-blur-md p-2 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-gray-200/50 dark:shadow-black/20 grid grid-cols-5 place-items-center">
            
            <!-- Generate -->
            <button 
              class="btn-unified flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              :class="{'opacity-50 grayscale': isGenerating}"
              @click="handleGenerate"
            >
              <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                <n-icon size="20"><SparklesOutline /></n-icon>
              </div>
              <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">生成</span>
            </button>

            <!-- Enrich -->
            <button 
              class="btn-unified flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              :disabled="isGenerating || !chapterContent"
              :class="{'opacity-50 grayscale': isGenerating || !chapterContent}"
              @click="handleEnrich"
            >
              <div class="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <n-icon size="20"><PencilOutline /></n-icon>
              </div>
              <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">扩写</span>
            </button>

            <!-- Copy -->
            <button 
              class="btn-unified flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              :disabled="isGenerating || !chapterContent"
              :class="{'opacity-50 grayscale': isGenerating || !chapterContent}"
              @click="handleCopy"
            >
              <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center">
                <n-icon size="20"><CopyOutline /></n-icon>
              </div>
              <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">复制</span>
            </button>

            <!-- Save -->
            <button 
              class="btn-unified flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
              :disabled="isGenerating || !chapterContent"
              :class="{'opacity-50 grayscale': isGenerating || !chapterContent}"
              @click="handleQuickSave"
            >
              <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                <n-icon size="20"><SaveOutline /></n-icon>
              </div>
              <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">保存</span>
            </button>

            <!-- Finalize -->
            <button 
              class="btn-unified flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20"
              :disabled="!chapterContent"
              :class="{'opacity-50 grayscale': isGenerating || !chapterContent}"
              @click="handleSaveAndFinalize"
            >
              <div class="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center">
                <n-icon size="20"><CheckmarkOutline /></n-icon>
              </div>
              <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">定稿</span>
            </button>
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
           <div v-if="currentChapterInfo" class="flex flex-wrap gap-1.5 md:gap-2 text-xs mb-3 pb-3 border-b border-gray-100 dark:border-gray-700/50">
              <span class="text-gray-400 self-center">目标:</span>
              <n-tag type="success" :bordered="false" round class="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 !h-auto !py-1 !px-2 !text-[10px] md:!text-xs whitespace-normal text-left leading-tight max-w-full">
                {{ currentChapterInfo.purpose }}
              </n-tag>
              <n-tag type="warning" :bordered="false" round class="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 !h-auto !py-1 !px-2 !text-[10px] md:!text-xs whitespace-normal text-left leading-tight max-w-full">
                {{ currentChapterInfo.suspense }}
              </n-tag>
              <div v-if="currentChapterInfo.summary" class="w-full mt-1 text-gray-500 italic text-xs leading-relaxed">
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

           <!-- Quality Check Results - 质检结果 -->
           <div v-if="isChecking" class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700/50">
             <div class="flex items-center gap-2">
               <ReloadOutline class="w-4 h-4 text-blue-500 animate-spin" />
               <span class="text-blue-700 dark:text-blue-300 text-sm">正在质检...</span>
             </div>
           </div>
           <div v-else-if="qualityCheckResult" class="mt-3 p-3 rounded-lg border" :class="qualityCheckResult.overallPass ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50'">
             <div class="flex items-center gap-2 mb-2">
               <CheckmarkCircleOutline v-if="qualityCheckResult.overallPass" class="w-4 h-4 text-green-600" />
               <WarningOutline v-else class="w-4 h-4 text-red-500" />
               <span class="font-medium text-sm" :class="qualityCheckResult.overallPass ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'">
                 {{ qualityCheckResult.overallPass ? '质检通过' : '质检发现问题' }}
               </span>
             </div>
             <div class="flex flex-wrap gap-2 text-xs">
               <n-tag :type="qualityCheckResult.wordCountPass ? 'success' : 'error'" size="small" :bordered="false" round>
                 字数: {{ qualityCheckResult.wordCount }}字 {{ qualityCheckResult.wordCountPass ? '✓' : '✗' }}
               </n-tag>
               <n-tag :type="qualityCheckResult.contentMatch ? 'success' : 'error'" size="small" :bordered="false" round>
                 内容匹配 {{ qualityCheckResult.contentMatch ? '✓' : '✗' }}
               </n-tag>
               <n-tag :type="!qualityCheckResult.nextChapterSpill ? 'success' : 'error'" size="small" :bordered="false" round>
                 未越界 {{ !qualityCheckResult.nextChapterSpill ? '✓' : '✗越界!' }}
               </n-tag>
               <n-tag :type="qualityCheckResult.hasCliffhanger ? 'success' : 'warning'" size="small" :bordered="false" round>
                 断章钩子 {{ qualityCheckResult.hasCliffhanger ? '✓' : '?' }}
               </n-tag>
             </div>
             <div v-if="qualityCheckResult.issues && qualityCheckResult.issues.length > 0" class="mt-2 text-xs text-red-600 dark:text-red-400">
               <div v-for="(issue, idx) in qualityCheckResult.issues" :key="idx">• {{ issue }}</div>
             </div>
             <!-- Fix button - 修复按钮 -->
             <div v-if="!qualityCheckResult.overallPass" class="mt-3 pt-2 border-t border-red-200 dark:border-red-700/50">
               <n-button type="warning" size="small" :loading="isGenerating" @click="handleFix">
                 <template #icon><n-icon><ReloadOutline /></n-icon></template>
                 AI 自动修复
               </n-button>
             </div>
           </div>
        </div>
      </div>
    </div>
  </div>
</template>
