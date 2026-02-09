/**
 * Utility Prompts - 工具类提示词
 * 用于摘要更新、角色状态更新等辅助功能
 */

/**
 * 前文摘要更新提示词
 */
export const summary = (params) => `
以下是新完成的章节文本：
${params.chapterText}

这是当前的前文摘要（可为空）：
${params.globalSummary || '(无)'}

请根据本章新增内容，更新前文摘要（番茄连载视角）。

更新时优先记录以下信息：
1. 主线冲突推进：谁压主角、主角如何反制。
2. 爽点兑现结果：本章打脸/收获是否落地。
3. 状态变化：战力、地位、资源、关系、信息的新增变化。
4. 章末钩子：本章结尾悬念和下一步危机。

要求：
- 保留既有重要信息，同时融入新剧情要点
- 以简洁、连贯的语言描述全书进展
- 客观描绘，不展开联想或解释
- 总字数控制在2000字以内
- 避免空泛修辞，优先可用于下一章创作的硬信息

仅返回前文摘要文本，不要解释任何内容。
`

/**
 * 角色状态更新提示词
 */
export const updateCharacterState = (params) => `
以下是新完成的章节文本：
${params.chapterText}

这是当前的角色状态文档：
${params.oldState}

请更新主要角色状态，保持原有格式结构。

要求：
- 请直接在已有文档基础上进行增删
- 不改变原有结构，语言尽量简洁、有条理
- 新出场角色简要描述即可，淡出视线的角色可删除
- 重点更新可影响下章的动态项：战力、伤势、资源、仇恨、倒计时
- 新增能力或道具必须标注来源；已消耗资源要及时扣除
- 避免写成人物小传，只保留“可执行状态”

仅返回更新后的角色状态文本，不要解释任何内容。
`

/**
 * 章节质检提示词
 * 自动检查生成的章节是否符合要求
 */
export const qualityCheck = (params) => `
你是一位严格的网文编辑，负责质检刚写完的章节。

当前章节信息：
- 章节编号：第${params.chapterNumber}章
- 章节标题：${params.chapterTitle}
- 章节大纲：${params.chapterSummary}
- 目标字数：${params.wordNumber}字
- 实际字数：${params.actualWordCount}字（已由系统统计，无需你再数）

下一章节信息（用于判断是否越界）：
- 下一章编号：第${params.nextChapterNumber}章
- 下一章标题：${params.nextChapterTitle}
- 下一章大纲：${params.nextChapterSummary || '(无)'}

章节正文：
${params.chapterText}

请从以下维度进行检查，并给出JSON格式的检查报告：

{
  "wordCount": ${params.actualWordCount},
  "wordCountPass": ${params.actualWordCount >= params.wordNumber * 0.85 && params.actualWordCount <= params.wordNumber * 1.15},
  "contentMatch": 内容是否符合当前章节大纲（true/false）,
  "nextChapterSpill": 是否包含下一章的内容（true/false，如果包含则为true表示有问题）,
  "hasCliffhanger": 结尾是否有断章钩子/悬念（true/false）,
  "overallPass": 是否通过质检（所有项目都OK则true）,
  "issues": ["问题1", "问题2"] // 如果有问题，列出具体问题
}

判断标准：
1. 字数：实际${params.actualWordCount}字，目标${params.wordNumber}字，${params.actualWordCount >= params.wordNumber * 0.85 && params.actualWordCount <= params.wordNumber * 1.15 ? '在85%-115%范围内，通过' : '超出85%-115%范围，不通过'}
2. 内容匹配：章节内容应该围绕当前章节大纲展开，不偏题
3. 越界检测：如果章节内容已经写到了下一章大纲的核心事件，则判定为越界
4. 断章钩子：结尾应该有悬念、危机或期待，让读者想看下一章

仅返回JSON，不要有任何其他文字。
`

/**
 * 章节修复提示词
 * 根据质检结果修复章节问题
 */
export const fixChapter = (params) => `
你是一位专业的网文编辑，需要根据质检发现的问题修复以下章节。

当前章节信息：
- 章节编号：第${params.chapterNumber}章
- 章节标题：${params.chapterTitle}
- 章节大纲：${params.chapterSummary}
- 目标字数：${params.wordNumber}字

下一章节信息（不要写进当前章节！）：
- 下一章编号：第${params.nextChapterNumber}章
- 下一章标题：${params.nextChapterTitle}

质检发现的问题：
${params.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

原章节内容：
${params.chapterText}

---

请根据以上问题进行修复，要求：

${params.wordCountPass === false ? `【字数问题】
- 当前字数：${params.wordCount}字，目标：${params.wordNumber}字
- 如果字数不足，请扩写：增加围观反应、对手失态、战斗细节、收益落地描写
- 如果字数过多，请精简：删除重复内容、冗余描写、无效对话
` : ''}

${params.nextChapterSpill === true ? `【越界问题】
- 当前章节包含了下一章的内容，请删除这部分
- 在删除后的位置添加合适的断章钩子，让读者期待下一章
- 不要写"第${params.nextChapterNumber}章"或"${params.nextChapterTitle}"的任何内容
` : ''}

${params.hasCliffhanger === false ? `【断章钩子问题】
- 结尾缺少悬念/钩子，请修改结尾
- 添加：危机未解/新敌登场/更大机缘/关键转折 之一
- 让读者产生"想看下一章"的强烈欲望
` : ''}

${params.contentMatch === false ? `【内容匹配问题】
- 章节内容与大纲不符，请调整内容使其符合本章大纲
- 确保本章核心事件与大纲描述一致
` : ''}

修复原则：
1. 尽量保留原文精华，只修改有问题的部分
2. 保持文风统一，不要突兀
3. 确保修复后字数在目标范围内（±15%）
4. 绝对不能写下一章的内容

仅返回修复后的章节正文，不要有任何解释。
`

/**
 * 导出所有工具类提示词
 */
export const utilityPrompts = {
  summary,
  updateCharacterState,
  qualityCheck,
  fixChapter
}
