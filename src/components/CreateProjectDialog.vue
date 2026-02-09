<script setup>
import { ref, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNovelStore } from '../stores/novel'
import { useMessage } from 'naive-ui'
import { NModal, NForm, NFormItem, NInput, NInputNumber, NSelect, NButton, NIcon } from 'naive-ui'
import { CheckmarkOutline } from '@vicons/ionicons5'

const props = defineProps({
  modelValue: Boolean
})

const emit = defineEmits(['update:modelValue'])
const router = useRouter()
const novelStore = useNovelStore()
const message = useMessage()

// Form data - 表单数据
const formRef = ref(null)
const form = reactive({
  title: '',
  topic: '',
  genre: ['玄幻'],
  numberOfChapters: 100,
  wordNumber: 3000,
  userGuidance: ''
})

// Genre options - 类型选项（按热度分组）
const genreOptions = [
  // 主流大类
  { label: '玄幻', value: '玄幻' },
  { label: '仙侠', value: '仙侠' },
  { label: '都市', value: '都市' },
  { label: '历史', value: '历史' },
  { label: '科幻', value: '科幻' },
  { label: '奇幻', value: '奇幻' },
  { label: '武侠', value: '武侠' },
  { label: '言情', value: '言情' },
  { label: '悬疑', value: '悬疑' },
  { label: '军事', value: '军事' },
  // 热门流派
  { label: '末日/废土', value: '末日/废土' },
  { label: '无限流', value: '无限流' },
  { label: '系统流', value: '系统流' },
  { label: '重生', value: '重生' },
  { label: '穿越', value: '穿越' },
  { label: '诡异流', value: '诡异流' },
  { label: '香火流', value: '香火流' },
  { label: '克苏鲁/诡秘', value: '克苏鲁/诡秘' },
  { label: '规则怪谈', value: '规则怪谈' },
  { label: '直播', value: '直播' },
  { label: '电竞', value: '电竞' },
  { label: '游戏', value: '游戏' },
  // 特色题材
  { label: '赘婿', value: '赘婿' },
  { label: '神豪', value: '神豪' },
  { label: '种田/经营', value: '种田/经营' },
  { label: '领主', value: '领主' },
  { label: '召唤流', value: '召唤流' },
  { label: '兵王', value: '兵王' },
  { label: '神医', value: '神医' },
  { label: '鉴宝', value: '鉴宝' },
  { label: '风水/玄学', value: '风水/玄学' },
  { label: '盗墓', value: '盗墓' },
  // 细分类型
  { label: '职场', value: '职场' },
  { label: '校园', value: '校园' },
  { label: '豪门', value: '豪门' },
  { label: '甜宠', value: '甜宠' },
  { label: '娱乐圈', value: '娱乐圈' },
  { label: '体育', value: '体育' },
  { label: '灵异', value: '灵异' },
  { label: '二次元', value: '二次元' },
  { label: '同人', value: '同人' },
  { label: '轻小说', value: '轻小说' },
  // 其他
  { label: '其他', value: '其他' }
]

// Form rules - 表单规则
const rules = {
  title: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  topic: [{ required: true, message: '请输入小说主题', trigger: 'blur' }],
  genre: [
    {
      required: true,
      trigger: 'change',
      validator: (_rule, value) => {
        if (Array.isArray(value) && value.length > 0) return true
        return new Error('请选择小说类型')
      }
    }
  ],
  numberOfChapters: [{ required: true, message: '请输入章节数量', trigger: 'blur', type: 'number' }],
  wordNumber: [{ required: true, message: '请输入每章字数', trigger: 'blur', type: 'number' }]
}

// Reset form when dialog opens - 打开对话框时重置表单
watch(() => props.modelValue, (val) => {
  if (val) {
    form.title = ''
    form.topic = ''
    form.genre = ['玄幻']
    form.numberOfChapters = 100
    form.wordNumber = 3000
    form.userGuidance = ''
  }
})

// Create project - 创建项目
async function createProject() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    const project = await novelStore.createProject({
      title: form.title,
      topic: form.topic,
      genre: form.genre,
      numberOfChapters: form.numberOfChapters,
      wordNumber: form.wordNumber,
      userGuidance: form.userGuidance
    })
    
    message.success('项目创建成功')
    emit('update:modelValue', false)
    router.push(`/project/${project.id}`)
  } catch (error) {
    // Validation failed
  }
}
</script>

<template>
  <n-modal
    :show="modelValue"
    @update:show="emit('update:modelValue', $event)"
    :mask-closable="false"
    preset="card"
    title="创建新项目"
    style="width: min(620px, calc(100vw - 20px))"
    :bordered="false"
    class="!rounded-2xl create-project-modal"
  >
    <n-form 
      ref="formRef"
      :model="form" 
      :rules="rules"
      label-placement="top"
      class="space-y-1 max-h-[68vh] overflow-y-auto pr-1"
    >
      <!-- Project title - 项目名称 -->
      <n-form-item label="项目名称" path="title">
        <n-input 
          v-model:value="form.title" 
          placeholder="例如：星辰大海"
          :maxlength="50"
          show-count
        />
      </n-form-item>

      <!-- Novel topic - 小说主题 -->
      <n-form-item label="小说主题 / 核心创意" path="topic">
        <n-input 
          v-model:value="form.topic" 
          type="textarea"
          :rows="3"
          placeholder="描述你的小说核心创意，例如：一个普通少年意外获得神秘传承，在修仙世界中逐步成长..."
          :maxlength="500"
          show-count
        />
      </n-form-item>

      <!-- Genre selection - 类型选择 -->
      <n-form-item label="小说类型" path="genre">
        <n-select 
          v-model:value="form.genre" 
          :options="genreOptions"
          multiple
          class="w-full"
        />
      </n-form-item>

      <!-- Chapter count and word count - 章节数和字数 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <n-form-item label="预计章节数" path="numberOfChapters">
          <n-input-number 
            v-model:value="form.numberOfChapters" 
            :min="10" 
            :max="10000"
            :step="10"
            class="w-full"
          />
        </n-form-item>

        <n-form-item label="每章字数" path="wordNumber">
          <n-input-number 
            v-model:value="form.wordNumber" 
            :min="1000" 
            :max="10000"
            :step="500"
            class="w-full"
          />
        </n-form-item>
      </div>

      <!-- User guidance - 用户指导 -->
      <n-form-item label="创作指导 (可选)">
        <n-input 
          v-model:value="form.userGuidance" 
          type="textarea"
          :rows="3"
          placeholder="可以在这里添加额外的创作要求，如特定角色设定、情节走向、写作风格等..."
          :maxlength="1000"
          show-count
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <n-button class="w-full sm:w-auto" @click="emit('update:modelValue', false)">取消</n-button>
        <n-button class="w-full sm:w-auto" type="primary" @click="createProject">
          <template #icon>
            <n-icon><CheckmarkOutline /></n-icon>
          </template>
          创建项目
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style>
.create-project-modal .n-card {
  max-height: calc(100vh - 24px);
}
</style>
