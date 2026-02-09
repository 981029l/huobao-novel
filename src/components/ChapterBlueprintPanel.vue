<script setup>
import { ref, computed } from 'vue'
import { useNovelStore } from '../stores/novel'
import { NButton, NInput, NTag, NIcon, NRadioGroup, NRadioButton } from 'naive-ui'
import { WarningOutline, ListOutline, PlayOutline, RefreshOutline, GridOutline, DocumentTextOutline, SearchOutline, GitNetworkOutline } from '@vicons/ionicons5'

const props = defineProps({
  project: Object,
  chapters: Array,
  isGenerating: Boolean,
  architectureGenerated: Boolean
})

const emit = defineEmits(['generate', 'regenerate'])
const novelStore = useNovelStore()

// View mode - 视图模式
const viewMode = ref('list') // 'list' | 'raw'

// Search query - 搜索查询
const searchQuery = ref('')

// Filtered chapters - 过滤后的章节
const filteredChapters = computed(() => {
  if (!searchQuery.value) return props.chapters
  const query = searchQuery.value.toLowerCase()
  return props.chapters.filter(ch => 
    ch.title.toLowerCase().includes(query) ||
    ch.summary.toLowerCase().includes(query)
  )
})

// Volume grouping - 分卷分组
const chaptersPerVolume = computed(() => {
  const total = props.project?.numberOfChapters || 100
  if (total > 500) return 80
  if (total > 200) return 50
  return 30
})

const volumeCount = computed(() => {
  return Math.ceil((props.project?.numberOfChapters || 100) / chaptersPerVolume.value)
})

// Get volume info for a chapter - 获取章节所属卷信息
function getVolumeInfo(chapterNumber) {
  const volumeIndex = Math.ceil(chapterNumber / chaptersPerVolume.value)
  const startChapter = (volumeIndex - 1) * chaptersPerVolume.value + 1
  const endChapter = Math.min(volumeIndex * chaptersPerVolume.value, props.project?.numberOfChapters || 100)
  return {
    volumeNumber: volumeIndex,
    startChapter,
    endChapter,
    isFirstInVolume: chapterNumber === startChapter
  }
}

// Chapters with volume info - 带卷信息的章节列表
const chaptersWithVolumes = computed(() => {
  return filteredChapters.value.map(chapter => ({
    ...chapter,
    volumeInfo: getVolumeInfo(chapter.number)
  }))
})

// Get twist level stars - 获取颠覆等级星星
function getTwistStars(level) {
  if (!level) return '☆☆☆☆☆'
  const starCount = (level.match(/★/g) || []).length
  return level
}

// Update raw blueprint - 更新原始大纲
function updateBlueprint(value) {
  novelStore.updateProject(props.project.id, { chapterBlueprint: value })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Not ready state - 未就绪状态 -->
    <div 
      v-if="!architectureGenerated" 
      class="bg-white dark:bg-[#1f1f23] rounded-2xl p-6 md:p-12 border border-gray-200/80 dark:border-gray-700/50 text-center"
    >
      <div class="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/25">
        <WarningOutline class="w-12 h-12 text-white" />
      </div>
      <h3 class="text-2xl font-bold text-gray-800 dark:text-white mb-3">
        请先生成小说架构
      </h3>
      <p class="text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
        章节大纲的生成需要基于小说架构（核心种子、角色体系、世界观、情节架构）
      </p>
    </div>

    <!-- Generate button area - 生成按钮区域 -->
    <div 
      v-else-if="!project.chapterBlueprint" 
      class="bg-white dark:bg-[#1f1f23] rounded-2xl p-6 md:p-12 border border-gray-200/80 dark:border-gray-700/50 text-center"
    >
      <div class="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-xl shadow-purple-500/25">
        <ListOutline class="w-12 h-12 text-white" />
      </div>
      <h3 class="text-2xl font-bold text-gray-800 dark:text-white mb-3">
        生成章节大纲
      </h3>
      <p class="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
        AI 将基于小说架构，生成 {{ project.numberOfChapters }} 章的详细大纲，包含悬念节奏曲线
      </p>
      <n-button 
        type="primary" 
        size="large"
        :loading="isGenerating"
        @click="emit('generate')"
        class="!px-8 !h-12"
      >
        <template #icon v-if="!isGenerating">
          <n-icon><PlayOutline /></n-icon>
        </template>
        {{ isGenerating ? '生成中...' : '开始生成大纲' }}
      </n-button>
    </div>

    <!-- Content area -->
    <template v-else>
      <!-- Toolbar -->
      <div class="mobile-toolbar-sticky mobile-surface-glass md:bg-white md:dark:bg-[#1f1f23] rounded-2xl p-3 md:p-4 border border-gray-100 dark:border-gray-800 shadow-sm">
        <!-- Mobile toolbar -->
        <div class="md:hidden space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              <span class="text-xs font-medium">共 {{ chapters.length }} 章</span>
            </div>

            <n-button
              :disabled="isGenerating"
              :loading="isGenerating"
              @click="emit('regenerate')"
              secondary
              class="regen-button !bg-gray-100 dark:!bg-gray-800"
            >
              <template #icon>
                <n-icon><RefreshOutline /></n-icon>
              </template>
              重新生成
            </n-button>
          </div>

          <div class="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-gray-100/90 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/60">
            <button
              @click="viewMode = 'list'"
              class="btn-unified h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200"
              :class="viewMode === 'list'
                ? 'bg-white dark:bg-[#25252a] text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'"
            >
              <GridOutline class="w-4 h-4" />
              卡片视图
            </button>
            <button
              @click="viewMode = 'raw'"
              class="btn-unified h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all duration-200"
              :class="viewMode === 'raw'
                ? 'bg-white dark:bg-[#25252a] text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400'"
            >
              <DocumentTextOutline class="w-4 h-4" />
              原始文本
            </button>
          </div>

          <n-input
            v-if="viewMode === 'list'"
            v-model:value="searchQuery"
            placeholder="搜索章节..."
            clearable
            class="!bg-gray-50 dark:!bg-gray-800/50 !rounded-xl !border-transparent hover:!bg-white focus:!bg-white transition-colors"
          >
            <template #prefix>
              <n-icon class="text-gray-400"><SearchOutline /></n-icon>
            </template>
          </n-input>
        </div>

        <!-- Desktop toolbar -->
        <div class="hidden md:flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <!-- View mode toggle -->
            <n-radio-group v-model:value="viewMode" size="small">
              <n-radio-button value="list">
                <div class="flex items-center gap-1">
                  <GridOutline class="w-4 h-4" />
                  卡片视图
                </div>
              </n-radio-button>
              <n-radio-button value="raw">
                <div class="flex items-center gap-1">
                  <DocumentTextOutline class="w-4 h-4" />
                  原始文本
                </div>
              </n-radio-button>
            </n-radio-group>

            <!-- Chapter count -->
            <n-tag :bordered="false" round class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              共 {{ chapters.length }} 章
            </n-tag>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto">
            <!-- Search -->
            <div class="relative flex-1 md:w-64">
               <n-input
                v-if="viewMode === 'list'"
                v-model:value="searchQuery"
                placeholder="搜索章节..."
                clearable
                class="!bg-gray-50 dark:!bg-gray-800/50 !rounded-xl !border-transparent hover:!bg-white focus:!bg-white transition-colors"
              >
                <template #prefix>
                  <n-icon class="text-gray-400"><SearchOutline /></n-icon>
                </template>
              </n-input>
            </div>

            <!-- Regenerate -->
            <n-button
              :disabled="isGenerating"
              :loading="isGenerating"
              @click="emit('regenerate')"
              secondary
              class="regen-button"
            >
              <template #icon>
                <n-icon><RefreshOutline /></n-icon>
              </template>
              重新生成
            </n-button>
          </div>
        </div>
      </div>

      <!-- List view -->
      <div v-if="viewMode === 'list'" class="space-y-4">
        <template v-for="chapter in chaptersWithVolumes" :key="chapter.number">
          

          <!-- Chapter Card -->
          <div 
            class="bg-white dark:bg-[#1f1f23] rounded-2xl p-4 md:p-5 border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-600/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group"
          >
          <div class="flex items-start gap-4">
            <!-- Chapter number -->
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <span class="text-white font-bold text-sm">{{ chapter.number }}</span>
            </div>

            <div class="flex-1 min-w-0">
              <!-- Title -->
              <h4 class="text-base md:text-lg font-bold text-gray-800 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <span class="mr-2">第{{ chapter.number }}章</span>
                {{ chapter.title }}
              </h4>

              <!-- Meta info -->
              <div class="flex flex-wrap gap-1.5 md:gap-2 mb-3">
                <n-tag v-if="chapter.position" :bordered="false" round class="bg-gray-100 dark:bg-gray-800 text-gray-500 !h-auto !py-1 !px-2 !text-[10px] md:!text-xs whitespace-normal text-left leading-tight">
                  {{ chapter.position }}
                </n-tag>
                <n-tag v-if="chapter.purpose" type="success" :bordered="false" round class="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 !h-auto !py-1 !px-2 !text-[10px] md:!text-xs whitespace-normal text-left leading-tight max-w-full">
                  {{ chapter.purpose }}
                </n-tag>
                <n-tag v-if="chapter.suspense" type="warning" :bordered="false" round class="bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 !h-auto !py-1 !px-2 !text-[10px] md:!text-xs whitespace-normal text-left leading-tight max-w-full">
                  {{ chapter.suspense }}
                </n-tag>
              </div>

              <!-- Summary -->
              <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-2.5 md:p-3 mb-3">
                 <p v-if="chapter.summary" class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                   {{ chapter.summary }}
                 </p>
              </div>

              <!-- Details -->
              <div class="flex flex-wrap items-start gap-2 md:gap-4 text-xs text-gray-400 dark:text-gray-500">
                <span v-if="chapter.foreshadowing" class="flex items-center gap-1 max-w-full break-words">
                  <GitNetworkOutline class="w-3.5 h-3.5" />
                  伏笔: {{ chapter.foreshadowing }}
                </span>
                <span v-if="chapter.twistLevel" class="flex items-center gap-1 max-w-full break-words">
                  认知颠覆: <span class="text-amber-400">{{ getTwistStars(chapter.twistLevel) }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        </template>
        <!-- Empty search result -->
        <div v-if="filteredChapters.length === 0" class="text-center py-16 bg-white dark:bg-[#1f1f23] rounded-2xl border border-gray-100 dark:border-gray-800 border-dashed">
          <SearchOutline class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p class="text-gray-500 dark:text-gray-400">没有找到匹配的章节</p>
        </div>
      </div>

      <!-- Raw view -->
      <div v-else>
        <n-input
          type="textarea"
          :value="project.chapterBlueprint"
          @update:value="updateBlueprint"
          :autosize="{ minRows: 20, maxRows: 50 }"
          class="novel-textarea"
        />
      </div>
    </template>
  </div>
</template>
