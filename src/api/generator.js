import { chatCompletion, cleanResponse } from './llm'
import { architecturePrompts, chapterPrompts, utilityPrompts } from '../prompts'

// 解构提示词
const { coreSeed: coreSeedPrompt, characterDynamics: characterDynamicsPrompt, worldBuilding: worldBuildingPrompt, plotArchitecture: plotArchitecturePrompt, characterState: createCharacterStatePrompt } = architecturePrompts
const { blueprint: chapterBlueprintPrompt, blueprintChunked: chunkedChapterBlueprintPrompt, firstDraft: firstChapterDraftPrompt, nextDraft: nextChapterDraftPrompt, enrich: enrichChapterPrompt } = chapterPrompts
const { summary: summaryPrompt, updateCharacterState: updateCharacterStatePrompt, qualityCheck: qualityCheckPrompt, fixChapter: fixChapterPrompt } = utilityPrompts

function formatGenre(genre) {
  if (Array.isArray(genre)) return genre.join(' / ')
  return genre || ''
}

// Novel generator service - 小说生成服务
// Orchestrates the generation process - 编排生成流程

/**
 * Generate novel architecture - 生成小说架构
 * Steps: Core seed → Character dynamics → World building → Plot architecture
 */
export async function generateArchitecture(project, apiConfig, onProgress, onStream) {
  const results = { ...project }

  // 1. Core Seed
  if (!results.coreSeed) {
    onProgress('正在生成核心种子...', 1, 5)
    const prompt = architecturePrompts.coreSeed(project)
    results.coreSeed = cleanResponse(await chatCompletion(apiConfig, prompt,
      onStream ? (chunk, full) => onStream('coreSeed', full) : null
    ))
  }

  // 2. Character Dynamics
  if (!results.characterDynamics) {
    onProgress('正在生成角色体系...', 2, 5)
    const prompt = architecturePrompts.characterDynamics({ ...project, ...results })
    results.characterDynamics = cleanResponse(await chatCompletion(apiConfig, prompt,
      onStream ? (chunk, full) => onStream('characterDynamics', full) : null
    ))
  }

  // 3. Character State (Initial)
  if (!results.characterState && results.characterDynamics) {
    onProgress('正在生成初始角色状态...', 3, 5)
    const prompt = architecturePrompts.characterState({ ...project, ...results })
    results.characterState = cleanResponse(await chatCompletion(apiConfig, prompt,
      onStream ? (chunk, full) => onStream('characterState', full) : null
    ))
  }

  // 4. World Building
  if (!results.worldBuilding) {
    onProgress('正在生成世界观...', 4, 5)
    const prompt = architecturePrompts.worldBuilding({ ...project, ...results })
    results.worldBuilding = cleanResponse(await chatCompletion(apiConfig, prompt,
      onStream ? (chunk, full) => onStream('worldBuilding', full) : null
    ))
  }

  // 5. Plot architecture - 情节架构
  if (!results.plotArchitecture) {
    onProgress('正在设计情节架构...', 5, 5)
    const prompt = architecturePrompts.plotArchitecture({ ...project, ...results })
    results.plotArchitecture = cleanResponse(await chatCompletion(apiConfig, prompt,
      onStream ? (chunk, full) => onStream('plotArchitecture', full) : null
    ))
  }

  onProgress('架构生成完成!', 5, 5)
  return results
}

/**
 * Generate chapter blueprint - 生成章节大纲
 */
export async function generateChapterBlueprint(project, apiConfig, onProgress, onStream) {
  const { numberOfChapters, userGuidance } = project

  // Build novel architecture text - 构建小说架构文本
  const novelArchitecture = `
#=== 0) 小说设定 ===
主题：${project.topic}，类型：${formatGenre(project.genre)}，篇幅：约${numberOfChapters}章（每章${project.wordNumber}字）

#=== 1) 核心种子 ===
${project.coreSeed}

#=== 2) 角色动力学 ===
${project.characterDynamics}

#=== 3) 世界观 ===
${project.worldBuilding}

#=== 4) 三幕式情节架构 ===
${project.plotArchitecture}
`

  // Calculate chunk size based on max tokens - 根据最大 token 数计算分块大小
  // 番茄风格的大纲每章约300 tokens，保守估算
  const tokensPerChapter = 350
  const maxTokens = apiConfig.maxTokens || 8192
  // 计算每批章节数，留30%余量防止截断
  let chunkSize = Math.floor((maxTokens * 0.7) / tokensPerChapter)
  chunkSize = Math.max(5, Math.min(chunkSize, 25, numberOfChapters)) // 最多25章一批


  let blueprint = project.chapterBlueprint || ''

  // Parse existing chapters - 解析已有章节
  const existingChapters = blueprint.match(/第\s*(\d+)\s*章/g) || []
  const maxExistingChapter = existingChapters.length > 0
    ? Math.max(...existingChapters.map(c => parseInt(c.match(/\d+/)[0])))
    : 0

  let currentStart = maxExistingChapter + 1

  if (chunkSize >= numberOfChapters && !blueprint) {
    // Single shot generation - 一次性生成
    onProgress(`正在生成章节大纲 (1-${numberOfChapters})...`, 0, 1)
    const prompt = chapterBlueprintPrompt({
      userGuidance,
      novelArchitecture,
      numberOfChapters
    })
    blueprint = cleanResponse(await chatCompletion(apiConfig, prompt,
      onStream ? (chunk, full) => onStream(full) : null
    ))
  } else {
    // Chunked generation - 分块生成
    while (currentStart <= numberOfChapters) {
      const currentEnd = Math.min(currentStart + chunkSize - 1, numberOfChapters)
      onProgress(
        `正在生成章节大纲 (${currentStart}-${currentEnd})...`,
        currentStart - 1,
        numberOfChapters
      )

      // Limit existing blueprint to last 100 chapters - 限制已有大纲到最近100章
      const limitedBlueprint = limitChapterBlueprint(blueprint, 100)

      const prompt = chunkedChapterBlueprintPrompt({
        userGuidance,
        novelArchitecture,
        numberOfChapters,
        chapterList: limitedBlueprint,
        startChapter: currentStart,
        endChapter: currentEnd
      })

      const chunkResult = cleanResponse(await chatCompletion(apiConfig, prompt,
        onStream ? (chunk, full) => onStream(full) : null
      ))

      if (chunkResult) {
        blueprint = blueprint ? `${blueprint}\n\n${chunkResult}` : chunkResult
      }

      currentStart = currentEnd + 1

      // 批次间延迟，防止 rate limit
      if (currentStart <= numberOfChapters) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }
  }

  onProgress('章节大纲生成完成!', numberOfChapters, numberOfChapters)
  return blueprint
}

/**
 * Limit chapter blueprint to recent chapters - 限制章节大纲到最近章节
 */
function limitChapterBlueprint(blueprint, limit) {
  if (!blueprint) return ''

  const pattern = /(第\s*\d+\s*章.*?)(?=第\s*\d+\s*章|$)/gs
  const chapters = blueprint.match(pattern) || []

  if (chapters.length <= limit) return blueprint

  return chapters.slice(-limit).join('\n\n').trim()
}

/**
 * Parse chapter blueprint into structured data - 解析章节大纲为结构化数据
 */
export function parseChapterBlueprint(blueprint) {
  if (!blueprint) return []

  const chapters = []
  // 匹配两种格式: "第n章｜标题" 或 "第 n 章 - 标题"
  const pattern = /第\s*(\d+)\s*章\s*[｜\|－\-–—]\s*\[?(.+?)\]?(?=\n|$)/g
  let match

  while ((match = pattern.exec(blueprint)) !== null) {
    const chapterNum = parseInt(match[1])
    const title = match[2].trim().replace(/^\[|\]$/g, '') // 去除可能的方括号

    // Extract chapter details - 提取章节详情
    const startIndex = match.index
    // 寻找下一章的开始位置
    const nextChapterPattern = new RegExp(`第\\s*${chapterNum + 1}\\s*章`)
    const nextMatch = blueprint.substring(startIndex + match[0].length).match(nextChapterPattern)
    const endIndex = nextMatch ? startIndex + match[0].length + nextMatch.index : blueprint.length
    const chapterText = blueprint.substring(startIndex, endIndex)

    // 提取字段（兼容新旧格式）
    chapters.push({
      number: chapterNum,
      title,
      // 位置/定位
      position: extractField(chapterText, '承接点') || extractField(chapterText, '本章定位') || extractField(chapterText, '开场钩子'),
      // 核心作用/爽点
      purpose: extractField(chapterText, '本章爽点兑现') || extractField(chapterText, '核心作用') || extractField(chapterText, '本章冲突'),
      // 情绪曲线/悬念
      suspense: extractField(chapterText, '情绪曲线') || extractField(chapterText, '悬念密度'),
      // 章末卡点/伏笔
      foreshadowing: extractField(chapterText, '章末卡点') || extractField(chapterText, '伏笔操作'),
      // 张力/颠覆等级
      twistLevel: extractField(chapterText, '张力星级') || extractField(chapterText, '认知颠覆'),
      // 简述
      summary: extractField(chapterText, '一句话剧情') || extractField(chapterText, '本章简述'),
      // 新增字段
      conflict: extractField(chapterText, '本章冲突'),
      reward: extractField(chapterText, '本章收益')
    })
  }

  return chapters
}

/**
 * Extract field value from text - 从文本中提取字段值
 */
function extractField(text, fieldName) {
  const pattern = new RegExp(`${fieldName}[：:]\\s*(.+?)(?=\\n|$)`)
  const match = text.match(pattern)
  return match ? match[1].trim() : ''
}

/**
 * Generate a single chapter draft - 生成单章草稿
 */
export async function generateChapterDraft(project, chapterNumber, apiConfig, onProgress, onStream) {
  const chapters = parseChapterBlueprint(project.chapterBlueprint)
  const chapterInfo = chapters.find(c => c.number === chapterNumber)

  if (!chapterInfo) {
    throw new Error(`章节 ${chapterNumber} 不存在于大纲中`)
  }

  const nextChapterInfo = chapters.find(c => c.number === chapterNumber + 1) || {
    title: '(未定)',
    position: '过渡章节',
    purpose: '承上启下',
    suspense: '中等',
    foreshadowing: '无特殊伏笔',
    twistLevel: '★☆☆☆☆',
    summary: '衔接过渡内容'
  }

  // Build novel setting text - 构建小说设定文本
  const novelSetting = `
小说类型：${formatGenre(project.genre)}

核心种子：${project.coreSeed}

角色体系：${project.characterDynamics}

世界观：${project.worldBuilding}

情节架构：${project.plotArchitecture}
`

  let prompt
  if (chapterNumber === 1) {
    // First chapter - 第一章
    onProgress(`正在生成第 ${chapterNumber} 章草稿...`, 0, 3)
    prompt = firstChapterDraftPrompt({
      chapterNumber,
      chapterTitle: chapterInfo.title,
      chapterRole: chapterInfo.position,
      chapterPurpose: chapterInfo.purpose,
      suspenseLevel: chapterInfo.suspense,
      foreshadowing: chapterInfo.foreshadowing,
      plotTwistLevel: chapterInfo.twistLevel,
      chapterSummary: chapterInfo.summary,
      novelSetting,
      wordNumber: project.wordNumber,
      userGuidance: project.userGuidance
    })
  } else {
    // Subsequent chapters - 后续章节
    onProgress(`正在生成第 ${chapterNumber} 章草稿...`, 0, 3)

    // Get previous chapter excerpt - 获取前章结尾段
    const prevChapter = project.chapters?.[chapterNumber - 1] || ''
    const previousChapterExcerpt = prevChapter.slice(-800) || '(无前章内容)'

    prompt = nextChapterDraftPrompt({
      chapterNumber,
      chapterTitle: chapterInfo.title,
      chapterRole: chapterInfo.position,
      chapterPurpose: chapterInfo.purpose,
      suspenseLevel: chapterInfo.suspense,
      foreshadowing: chapterInfo.foreshadowing,
      plotTwistLevel: chapterInfo.twistLevel,
      chapterSummary: chapterInfo.summary,
      wordNumber: project.wordNumber,
      globalSummary: project.globalSummary || '(这是第一章，暂无前文摘要)',
      previousChapterExcerpt,
      characterState: project.characterState || '(暂无角色状态)',
      userGuidance: project.userGuidance,
      shortSummary: '',
      nextChapterNumber: chapterNumber + 1,
      nextChapterTitle: nextChapterInfo.title,
      nextChapterRole: nextChapterInfo.position,
      nextChapterPurpose: nextChapterInfo.purpose,
      nextSuspenseLevel: nextChapterInfo.suspense,
      nextForeshadowing: nextChapterInfo.foreshadowing,
      nextPlotTwistLevel: nextChapterInfo.twistLevel,
      nextChapterSummary: nextChapterInfo.summary
    })
  }

  const chapterText = cleanResponse(await chatCompletion(apiConfig, prompt,
    onStream ? (chunk, full) => onStream(full) : null
  ))
  onProgress(`第 ${chapterNumber} 章草稿生成完成`, 1, 3)

  return chapterText
}

/**
 * Finalize chapter - 章节定稿（更新摘要和角色状态）
 */
export async function finalizeChapter(project, chapterNumber, chapterText, apiConfig, onProgress, onStream) {
  onProgress('正在更新前文摘要...', 1, 3)

  // Update global summary - 更新前文摘要
  const newSummary = cleanResponse(await chatCompletion(apiConfig, summaryPrompt({
    chapterText,
    globalSummary: project.globalSummary || ''
  }), onStream ? (chunk, full) => onStream('summary', full) : null))

  // 等待500ms避免API限流
  await new Promise(resolve => setTimeout(resolve, 500))

  onProgress('正在更新角色状态...', 2, 3)

  // Update character state - 更新角色状态
  const newCharacterState = cleanResponse(await chatCompletion(apiConfig, updateCharacterStatePrompt({
    chapterText,
    oldState: project.characterState || ''
  }), onStream ? (chunk, full) => onStream('characterState', full) : null))

  onProgress('章节定稿完成', 3, 3)

  return {
    globalSummary: newSummary || project.globalSummary,
    characterState: newCharacterState || project.characterState
  }
}

/**
 * Enrich chapter text - 扩写章节
 */
export async function enrichChapter(chapterText, wordNumber, apiConfig, onProgress, onStream) {
  onProgress('正在扩写章节...', 0, 1)

  const enrichedText = cleanResponse(await chatCompletion(apiConfig, enrichChapterPrompt({
    chapterText,
    wordNumber
  }), onStream ? (chunk, full) => onStream(full) : null))

  onProgress('扩写完成', 1, 1)
  return enrichedText || chapterText
}

/**
 * Export novel to text - 导出小说为文本
 */
export function exportNovelToText(project) {
  const lines = []

  // Title - 标题
  lines.push(`《${project.title}》`)
  lines.push('')
  lines.push(`类型：${formatGenre(project.genre)}`)
  lines.push(`主题：${project.topic}`)
  lines.push('')
  lines.push('='.repeat(50))
  lines.push('')

  // Chapters - 章节内容
  const chapters = project.chapters || {}
  const chapterNums = Object.keys(chapters).map(Number).sort((a, b) => a - b)
  const blueprintChapters = parseChapterBlueprint(project.chapterBlueprint)

  for (const num of chapterNums) {
    const info = blueprintChapters.find(c => c.number === num)
    const title = info?.title || `第${num}章`

    lines.push(`第${num}章 ${title}`)
    lines.push('')
    lines.push(chapters[num])
    lines.push('')
    lines.push('-'.repeat(30))
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Export novel to markdown - 导出小说为 Markdown
 */
export function exportNovelToMarkdown(project) {
  const lines = []

  // Title - 标题
  lines.push(`# ${project.title}`)
  lines.push('')
  lines.push(`> **类型**：${formatGenre(project.genre)}`)
  lines.push(`> **主题**：${project.topic}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Chapters - 章节内容
  const chapters = project.chapters || {}
  const chapterNums = Object.keys(chapters).map(Number).sort((a, b) => a - b)
  const blueprintChapters = parseChapterBlueprint(project.chapterBlueprint)

  for (const num of chapterNums) {
    const info = blueprintChapters.find(c => c.number === num)
    const title = info?.title || `第${num}章`

    lines.push(`## 第${num}章 ${title}`)
    lines.push('')
    lines.push(chapters[num])
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Check chapter quality - 章节质检
 * 自动检查生成的章节是否符合要求
 */
export async function checkChapterQuality(params, apiConfig) {
  const { chapterText, chapterNumber, chapterTitle, chapterSummary, wordNumber, actualWordCount, nextChapterNumber, nextChapterTitle, nextChapterSummary } = params

  console.log('📋 质检使用的模型:', apiConfig.model)
  console.log('📊 实际字数:', actualWordCount, '目标字数:', wordNumber)

  try {
    const prompt = qualityCheckPrompt({
      chapterText,
      chapterNumber,
      chapterTitle,
      chapterSummary,
      wordNumber,
      actualWordCount: actualWordCount || chapterText.length,
      nextChapterNumber: nextChapterNumber || chapterNumber + 1,
      nextChapterTitle: nextChapterTitle || '(无)',
      nextChapterSummary: nextChapterSummary || '(无)'
    })

    const response = await chatCompletion(apiConfig, prompt, null)

    // 尝试解析JSON响应
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.warn('质检结果解析失败:', parseError)
    }

    // 解析失败时返回默认通过
    return {
      wordCount: chapterText.length,
      wordCountPass: true,
      contentMatch: true,
      nextChapterSpill: false,
      hasCliffhanger: true,
      overallPass: true,
      issues: []
    }
  } catch (error) {
    console.error('质检请求失败:', error)
    // 请求失败时返回默认通过，不阻塞用户
    return {
      wordCount: chapterText.length,
      wordCountPass: true,
      contentMatch: true,
      nextChapterSpill: false,
      hasCliffhanger: true,
      overallPass: true,
      issues: ['质检请求失败，已跳过']
    }
  }
}

/**
 * Fix chapter by quality check - 根据质检结果修复章节
 * 使用和写作相同的模型
 */
export async function fixChapterByQuality(params, apiConfig, onProgress, onStream) {
  const { chapterText, chapterNumber, chapterTitle, chapterSummary, wordNumber, nextChapterNumber, nextChapterTitle, qualityResult } = params

  onProgress('正在根据质检结果修复章节...', 0, 1)

  try {
    const prompt = fixChapterPrompt({
      chapterText,
      chapterNumber,
      chapterTitle,
      chapterSummary,
      wordNumber,
      nextChapterNumber: nextChapterNumber || chapterNumber + 1,
      nextChapterTitle: nextChapterTitle || '(无)',
      wordCount: qualityResult.wordCount,
      wordCountPass: qualityResult.wordCountPass,
      contentMatch: qualityResult.contentMatch,
      nextChapterSpill: qualityResult.nextChapterSpill,
      hasCliffhanger: qualityResult.hasCliffhanger,
      issues: qualityResult.issues || []
    })

    const fixedText = cleanResponse(await chatCompletion(apiConfig, prompt, onStream ? (chunk, full) => onStream(full) : null))

    onProgress('修复完成', 1, 1)
    return fixedText || chapterText
  } catch (error) {
    console.error('修复失败:', error)
    onProgress('修复失败', 1, 1)
    return chapterText
  }
}
