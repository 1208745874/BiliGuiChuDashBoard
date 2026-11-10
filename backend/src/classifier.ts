//发给AI数据并处理AI返回的数据

import axios from 'axios'
import type {Video} from './types'
import{ALLOWED_CATEGORIES, type CategoryName} from './categories'
// import 'dotenv/config'//密钥弄进来

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const API_KEY = process.env.DEEPSEEK_API_KEY


//调用API
async function callLLM(prompt: string):Promise<unknown>{
    if(!API_KEY) throw new Error('缺少 DEEPSEEK_API_KEY, 请检测.env')

    const res = await axios.post(
        DEEPSEEK_API_URL,
        {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'system',
                    content: '你是一个B站鬼畜区视频分类助手。你只输出JSON格式',
                },
                {
                    role: 'user',
                    content: prompt
                },
            ],
            response_format: {type: 'json_object'},
            temperature: 0.1,
            max_tokens: 1000,
        },
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    )

    const content = res.data.choices[0].message.content

    if(!content || content.trim() === ''){
        throw new Error('模型返回了空内容')
    }

    return JSON.parse(content)
}

// 构建批量分类的提示词
function buildPrompt(batch: Video[]): string {
  const videoLines = batch.map((v) => `${v.id}: ${v.title}`).join('\n')
  
  return `请根据以下视频标题，从指定的分类中选出唯一一个最匹配的标签。
  
可选分类：${ALLOWED_CATEGORIES.join('、')}

规则：
- 只能从上述分类中选择，不得创造新分类。
- 如果标题无法匹配任何专属标签，选“其他”。
- 按 JSON 格式返回。

期望的 JSON 格式示例：
{
  "results": [
    { "id": "BV1xx411c7mD", "category": "哲学" },
    { "id": "BV1yy411c7mE", "category": "全明星" }
  ]
}

输入标题列表：
${videoLines}`
}

// 校验并提取结果
function validateResults(raw: unknown, batch: Video[]): Map<string, CategoryName> {
  const map = new Map<string, CategoryName>()
  
  // 类型守卫：确保 raw 是个对象且包含 results 数组
  if (typeof raw !== 'object' || raw === null || !('results' in raw)) {
    throw new Error('JSON 结构不符合预期：缺少 results 字段')
  }
  
  const results = (raw as { results: unknown[] }).results
  if (!Array.isArray(results)) {
    throw new Error('results 不是数组')
  }

  const validCategories = new Set(ALLOWED_CATEGORIES)

  for (const item of results) {
    if (typeof item !== 'object' || item === null) continue
    const { id, category } = item as { id?: string; category?: string }
    
    if (!id || !category) continue
    // 校验：category 必须在白名单内
    if (!validCategories.has(category as CategoryName)) continue

    map.set(id, category as CategoryName)
  }

  // 检查是否漏了批次的视频（模型可能少返回）
  for (const video of batch) {
    if (!map.has(video.id)) {
      map.set(video.id, '其他') // 漏掉的降级为“其他”
    }
  }

  return map
}

// 主函数：分批 + 重试
export async function classifyVideos(
  videos: Video[],
  batchSize = 10
): Promise<Video[]> {
  const categoryMap = new Map<string, CategoryName>()

  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize)
    let success = false

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const prompt = buildPrompt(batch)
        const raw = await callLLM(prompt)
        const validated = validateResults(raw, batch)
        
        validated.forEach((cat, id) => categoryMap.set(id, cat))
        success = true
        break // 成功就跳出重试循环
      } catch (err) {
        console.warn(`批次 ${i} 第 ${attempt} 次尝试失败：`, err)
      }
    }

    if (!success) {
      // 三次都失败，这批全部降级为“其他”
      batch.forEach((v) => categoryMap.set(v.id, '其他'))
    }
  }

  // 组装最终结果
  //Array.prototype.map 有一条死规矩：
  // 它返回的新数组，长度和顺序，
  // 与你调用它的原数组(就这个videos啊)一模一样。
  return videos.map((v) => ({
    ...v,
    category: categoryMap.get(v.id) ?? '其他',
  }))
}