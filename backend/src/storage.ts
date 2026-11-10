import fs from 'node:fs/promises'
import path from 'node:path'
import type { Video } from './types'

//文件路径说是
const DB_PATH = path.resolve(process.cwd(), 'db.json')

//数据结构
export interface DBData{
    lastUpdateTime: string
    videos: Video[]
}

//保存一下数数据
export async function saveToDB(videos: Video[]){
    const data: DBData = {
        lastUpdateTime: new Date().toISOString(),
        videos,
    }
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

//读取数据的
export async function loadFromDB(): Promise<DBData | null>{
    try{
        const content = await fs.readFile(DB_PATH, 'utf-8')
        return JSON.parse(content) as DBData
    }catch{
        //如果文件不存在readFile会崩溃，所以要try ctach
        return null
    }
}