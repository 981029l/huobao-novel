<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNovelStore } from '../stores/novel'
import { useMessage, useDialog, NButton, NIcon } from 'naive-ui'
import { AddOutline, DocumentTextOutline, RocketOutline, PersonOutline, TrendingUpOutline } from '@vicons/ionicons5'
import CreateProjectDialog from '../components/CreateProjectDialog.vue'
import ProjectCard from '../components/ProjectCard.vue'

const router = useRouter()
const novelStore = useNovelStore()
const message = useMessage()
const dialog = useDialog()

const showCreateDialog = ref(false)

const mobileStats = computed(() => {
  const projects = novelStore.projectList || []

  const writtenChapters = projects.reduce(
    (sum, project) => sum + Object.keys(project.chapters || {}).length,
    0
  )

  const totalWords = projects.reduce((sum, project) => {
    return sum + Object.values(project.chapters || {}).reduce((inner, chapterText) => {
      return inner + (chapterText?.length || 0)
    }, 0)
  }, 0)

  return [
    { label: '项目数', value: String(projects.length) },
    { label: '已写章节', value: String(writtenChapters) },
    { label: '累计字数', value: totalWords >= 10000 ? `${(totalWords / 10000).toFixed(1)}w` : String(totalWords) }
  ]
})

// Delete project with confirmation - 确认后删除项目
async function handleDelete(project) {
  dialog.warning({
    title: '删除确认',
    content: `确定要删除项目 "${project.title}" 吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      novelStore.deleteProject(project.id)
      message.success('项目已删除')
    }
  })
}

// Open project - 打开项目
function openProject(project) {
  router.push(`/project/${project.id}`)
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 pb-24 md:pb-0">
    <!-- Hero Section -->
    <div class="text-center py-6 md:py-16 mb-2 md:mb-8">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 md:px-4 md:py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs md:text-sm font-medium mb-4 md:mb-6">
        <RocketOutline class="w-4 h-4" />
        基于雪花写作法的 AI 创作工具
      </div>
      <h1 class="text-[30px] leading-tight md:text-5xl font-bold mb-3 md:mb-6 bg-gradient-to-r from-gray-900 via-indigo-800 to-purple-800 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
        AI 小说生成器
      </h1>
      <p class="text-gray-600 dark:text-gray-400 text-sm md:text-lg max-w-2xl mx-auto mb-6 md:mb-10 leading-relaxed px-4 md:px-0">
        智能生成小说架构、角色体系、世界观和章节大纲，让创作更高效
      </p>
      
      <!-- Desktop Create Button (Hidden on Mobile) -->
      <n-button 
        type="primary" 
        size="large"
        @click="showCreateDialog = true"
        class="hidden md:inline-flex !px-8 !h-12 !text-base shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-shadow"
      >
        <template #icon>
          <n-icon><AddOutline /></n-icon>
        </template>
        创建新项目
      </n-button>

      <div class="md:hidden flex items-center justify-center gap-2 mt-4 flex-wrap">
        <div class="px-3 py-1 rounded-lg bg-white dark:bg-[#1f1f23] border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          雪花写作法
        </div>
        <div class="px-3 py-1 rounded-lg bg-white dark:bg-[#1f1f23] border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          本地存储
        </div>
        <div class="px-3 py-1 rounded-lg bg-white dark:bg-[#1f1f23] border border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          流式生成
        </div>
      </div>

      <div class="md:hidden mt-4 p-2 rounded-2xl mobile-surface-glass border border-gray-100/80 dark:border-gray-700/70 shadow-sm">
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="stat in mobileStats"
            :key="stat.label"
            class="rounded-xl py-2.5 text-center bg-white/80 dark:bg-[#25252a]/80 border border-gray-100/80 dark:border-gray-700/70"
          >
            <div class="text-sm font-bold text-gray-800 dark:text-gray-100">{{ stat.value }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ stat.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects Grid -->
    <div v-if="novelStore.hasProjects" class="mb-12">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-800 dark:text-white">
          我的项目
          <span class="text-sm font-normal text-gray-400 ml-2">
            ({{ novelStore.projectList.length }})
          </span>
        </h2>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <ProjectCard
          v-for="project in novelStore.projectList"
          :key="project.id"
          :project="project"
          @click="openProject(project)"
          @delete="handleDelete(project)"
        />
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-else 
      class="text-center py-12 md:py-20 bg-white dark:bg-[#1f1f23] rounded-3xl border-0 shadow-sm md:border md:border-gray-100 dark:md:border-gray-800"
    >
      <div class="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 flex items-center justify-center">
        <DocumentTextOutline class="w-10 h-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">开启创作之旅</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-8 text-sm">点击下方按钮创建你的第一个项目</p>
      <!-- Mobile Empty Action -->
      <n-button 
         type="primary" 
         class="md:hidden shadow-lg shadow-indigo-500/30 !px-8 !h-11" 
         round
         @click="showCreateDialog = true"
      >
        立即创建
      </n-button>
    </div>

    <!-- Mobile Floating Action Button (FAB) -->
    <div v-if="novelStore.hasProjects" class="md:hidden fixed right-5 z-50 mobile-fab-safe">
      <button 
        @click="showCreateDialog = true"
        class="btn-unified w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/40 flex items-center justify-center active:scale-95 transition-transform"
      >
        <n-icon size="28"><AddOutline /></n-icon>
      </button>
    </div>

    <!-- Features Section (Desktop Only for simpler mobile view) -->
    <div class="hidden md:block mt-20 mb-12">
      <h2 class="text-2xl font-bold text-center text-gray-800 dark:text-white mb-10">核心功能</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-[#1f1f23] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <RocketOutline class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">雪花写作法</h3>
          <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            从核心种子开始，逐步扩展角色、世界观、情节架构，构建完整故事
          </p>
        </div>

        <div class="bg-white dark:bg-[#1f1f23] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <PersonOutline class="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">角色弧光理论</h3>
          <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            设计具有动态变化潜力的角色，包含驱动力三角和关系冲突网
          </p>
        </div>

        <div class="bg-white dark:bg-[#1f1f23] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUpOutline class="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-2">悬念节奏曲线</h3>
          <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            智能规划章节节奏，设置认知过山车，保持读者阅读兴趣
          </p>
        </div>
      </div>
    </div>

    <!-- Create Project Dialog -->
    <CreateProjectDialog v-model="showCreateDialog" />
  </div>
</template>

<style scoped>
.mobile-fab-safe {
  bottom: calc(1.25rem + env(safe-area-inset-bottom));
}
</style>
