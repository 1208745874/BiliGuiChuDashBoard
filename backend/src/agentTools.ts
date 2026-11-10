import fs from 'node:fs/promises'
import path from 'node:path'
import type {Video} from './types'

//搜索视频(从后端缓存视频搜标题)
export function searchBilibili(keyword: string, cachedVideos: Video[]){
    const results = cachedVideos.filter(v => v.title.includes(keyword))
    return results.slice(0,3).map(v => ({
        id: v.id,
        title: v.title,
        upName: v.upName,
        category: v.category,
    }))
}

//查询热梗百科(读取本地json)
export async function searchMemeWiki(memeName: string){
    const wikiPath = path.resolve(process.cwd(), 'src', 'memeWiki.json')
    try{
        const content = await fs.readFile(wikiPath, 'utf-8')
        const wiki = JSON.parse(content)
        return wiki[memeName] || '百科中未收录该梗'
    }catch(err){
        return '百科数据读取失败'
    }
}
