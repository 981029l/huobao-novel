import axios from 'axios'

// LLM API service - LLM API 服务
// Handles all AI model interactions - 处理所有 AI 模型交互

/**
 * Create chat completion request
 * 创建聊天补全请求
 */
export async function chatCompletion(config, prompt, onStream = null) {
  const { baseUrl, apiKey, model, temperature, maxTokens, timeout } = config

  const requestBody = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
    stream: !!onStream
  }

  if (onStream) {
    // Streaming response - 流式响应
    return streamCompletion(baseUrl, apiKey, requestBody, timeout, onStream)
  }

  // Non-streaming response - 非流式响应
  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    requestBody,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: timeout * 1000
    }
  )

  return response.data.choices[0].message.content
}

/**
 * Fetch available models - 获取可用模型列表
 */
export async function fetchModels(config) {
  const { baseUrl, apiKey, timeout } = config

  const response = await axios.get(
    `${baseUrl}/models`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: timeout * 1000
    }
  )

  return response.data.data // Assuming standard OpenAI format { data: [{ id: '...' }] }
}

/**
 * Stream completion with callback and retry logic
 * 流式补全并回调，带重试机制
 */
async function streamCompletion(baseUrl, apiKey, requestBody, timeout, onStream, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        // 502/503/504 等网关错误，可以重试
        if ([502, 503, 504, 429].includes(response.status) && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000 // 指数退避: 2s, 4s, 8s
          console.warn(`API 返回 ${response.status}，${delay / 1000}秒后重试 (${attempt}/${retries})...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`API request failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      // 节流控制：每100ms最多更新一次UI
      let lastUpdateTime = 0
      const throttleInterval = 100 // ms
      let pendingUpdate = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                fullContent += content

                // 节流更新UI
                const now = Date.now()
                if (now - lastUpdateTime >= throttleInterval) {
                  onStream(content, fullContent)
                  lastUpdateTime = now
                  if (pendingUpdate) {
                    clearTimeout(pendingUpdate)
                    pendingUpdate = null
                  }
                } else if (!pendingUpdate) {
                  // 确保最后一次更新不会丢失
                  pendingUpdate = setTimeout(() => {
                    onStream(content, fullContent)
                    lastUpdateTime = Date.now()
                    pendingUpdate = null
                  }, throttleInterval)
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // 确保最终内容被回调
      if (pendingUpdate) {
        clearTimeout(pendingUpdate)
      }
      onStream('', fullContent) // 最终回调

      return fullContent
    } catch (error) {
      // 网络错误等可重试
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000
        console.warn(`请求失败: ${error.message}，${delay / 1000}秒后重试 (${attempt}/${retries})...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}

/**
 * Clean AI response - remove markdown formatting
 * 清理 AI 响应 - 移除 markdown 格式
 */
export function cleanResponse(text) {
  if (!text) return ''

  // Remove markdown code blocks - 移除 markdown 代码块
  let cleaned = text.replace(/```[\s\S]*?```/g, '')
  cleaned = cleaned.replace(/`/g, '')

  // Trim whitespace - 去除空白
  cleaned = cleaned.trim()

  return cleaned
}
