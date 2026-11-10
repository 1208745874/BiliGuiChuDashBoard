//主程序

import 'dotenv/config'//环境变量弄进来 且得放第一行 全局生效
import express, {Request, Response, NextFunction } from 'express'
import type { APIResponse, Category } from './types'
import type {Video} from './types'
import {fetchRankingVideos, fetchVideoDetail} from './bilibili'
import{classifyVideos} from './classifier'

import cron from 'node-cron'
import {saveToDB, loadFromDB} from './storage'

import cors from 'cors'
import rateLimit from 'express-rate-limit'

import jwt from 'jsonwebtoken'

import {authenticateToken} from './auth'

import {runMultiAgent} from './agent'


const app = express()//先创建实例
const PORT = 3000

//从环境变量读出白名单，转数据
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim())
//配置下CORS中间件
app.use(cors({
  origin: (origin, callback) => {
    //允许没有origin的请求
    if(!origin) return callback(null, true)

    //审查一下在不在白名单里面
    if(allowedOrigins.includes(origin)){
      callback(null, true)
    }else{
      callback(new Error('不被CORS白名单允许的来源'))
    }
  },

  //允许携带凭证
  credentials: true
}))//查身份

//解析请求体
app.use(express.json())

//配置限流规则
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, //15mins
  max: 300,
  message: {
    code: 429,
    message: '请求频繁,请15min后再试',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false
})

app.use('/api',limiter)//再限制频率


//登录路由
app.post('/api/auth/login', (req, res) => {
  const {username, password} = req.body
  
  //校验账号密码，这里硬编码了，后面得改去另外查
  if(username === 'zsyonghuming' && password === 'zspassword'){
    //生成token
    //参数1：要存进token的数据
    //参数2：密钥（JWT_SECRET）
    //参数3：过期时间
    const token = jwt.sign(
      {userId: 1, role: 'admin'},//硬编码了，假设只有一个固定管理员账号
      process.env.JWT_SECRET as string,
      { expiresIn: '2h'}
    )

    //给前端token
    res.json({
      code: 0,
      message: '登录成功',
      data: {token}
    })
  }else{
    res.status(401).json({
      code: 401,
      message: '账号或密码错误',
      data: null
    })
  }
})






//业务路由区
let cachedVideos: Video[] = []
let lastUpdateTime = ''

//统一API响应格式
app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: { ok: true, message: 'backend is running' }
  })
})

app.get('/api/videos', authenticateToken, (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: cachedVideos, 
  })
})

app.get('/api/video/:id', authenticateToken, (req, res) => {
  const video = cachedVideos.find(v => v.id === req.params.id)
  //do find
  if(video){
    res.json({
      code: 0,
      message: 'success',
      data: video
    })
  }
  else{
    //这里直接返回404，而不是走全局错误中间件，是因为“业务的没找到”不算服务器错误，应该返回404
    res.status(404).json({
      code: 404,
      message: 'Video not found',
      data: null
    })
  }
})

app.get('/api/categories', authenticateToken, (req, res) => {
  const counter = new Map<string, number>()

  for(const v of cachedVideos){
    const key = v.category || '未分类'
    counter.set(key, (counter.get(key) || 0) + 1)
  }

  const data = Array.from(
    counter.entries()
  ).map(
    ([name, count]) => ({name, count})
  )

  res.json({
    code: 0,
    message: 'success',
    data
  })
})

//上次更新的时间
app.get('/api/status', authenticateToken, (req, res) => {
  res.json({
    code: 0,
    message: 'success',
    data: lastUpdateTime
  })
})

app.get('/api/error-test', (req, res, next) => {
  try {
    throw new Error('测试错误：服务器崩溃啦！')
  } catch (err) {
    next(err) // 触发全局错误中间件
  }
})


app.post('/api/agent/multi-analyze', authenticateToken, async(req, res, next) => {
  try{
    const { question } = req.body
    if(!question) throw new Error('请提供question')

    const finalReport = await runMultiAgent(question, cachedVideos)
    res.json({
      code: 0,
      message: 'success',
      data: {
        report: finalReport
      }
    })
  }catch(err){
    next(err)
  }
})



//上面没有的接口最后会落到这里
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
    data: null
  })
})

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  //err是错误对象
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误',
    data: null
  })
})










async function updateData(){
  console.log('开始拉取并分类数据...')

  const rankingVideos = await fetchRankingVideos()
  const enrichedVideos: Video[] = []

  for(let i = 0; i < rankingVideos.length; i += 4){
    const batch = rankingVideos.slice(i, i+4)
    const details = await Promise.all(
      batch.map((v) => fetchVideoDetail(v.id).catch(() => ({})))//失败一个不影响全部
    )
    enrichedVideos.push(...batch.map((v, idx) => ({...v, ...details[idx]})))
    await new Promise((r) => setTimeout(r, 1000))//控制频率
  }

  cachedVideos = await classifyVideos(enrichedVideos)
  await saveToDB(cachedVideos)

  console.log('数据更新完毕并已保存')
}

async function initData(){
  //读一下本地文件看看
  const db = await loadFromDB()
  if(db){
    console.log('发现本地文件,直接加载。')
    cachedVideos = db.videos
    lastUpdateTime = db.lastUpdateTime
  }else{
    //没有本地文件就去拉取
    await updateData()
  }

  //设置定时任务，每天下午三点半拉取一次
  cron.schedule('30 15 * * *', async() => {
    console.log('定时任务触发:自动更新数据')
    await updateData()
  })
}

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
})

initData()