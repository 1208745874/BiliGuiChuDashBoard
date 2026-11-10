<script setup lang="ts">

import { ref, onMounted, onUnmounted, computed } from 'vue'//computed方法牛逼啊
import axios from 'axios'


//导入写的Video和Category类型
import type {Video} from '@/types'

//导入分类按钮顺序
import { ALLOWED_CATEGORIES } from '@/categories'

//导入写的封装axios，
import { request } from '@/api/request'

//导入watch,监听到变量变化可以干点事
import { watch } from 'vue'

import type {EChartsOption} from 'echarts'

import ChartBox from '@/components/ChartBox.vue'


//负责token的
const token = ref(localStorage.getItem('token') || '')
const loginForm = ref({
  username: 'zsyonghuming', 
  password: 'zspassword'
})

const handleLogin = async() => {
  try{
    const res = await axios.post('/api/auth/login', loginForm.value)

    token.value = res.data.data.token
    localStorage.setItem('token', token.value)

    window.location.reload
  }catch(error: any){
    const errorMsg = error.response?.data?.message || '登录失败,请检查网络'
    alert(errorMsg)
  }
}




const message = ref('加载中...')

const videos = ref<Video[]>([])

//测试一下返回更新时间
const lastUpdateTime = ref('')

//1、视频的总个数
const totalCount = computed(() => videos.value.length)

//2、所有视频的总播放量
const totalPlayCount = computed(() => {
  return videos.value.reduce((sum, video) => sum + video.playCount, 0)
})

//3、分类的数量: 用Set去重
const categoryCount = computed(() => {
  const categories = videos.value.map((v) => v.category)
  return new Set(categories).size
})

//现在选中的分类，可以在button处，通过@click修改
const currentCategory = ref('全部')

//分类按钮的内容: 先获取所有视频的分类,再去重,再按ALLOWED_CATEGORIES顺序排序
const categoryButton = computed(() => {
  const usedCategories = new Set(videos.value.map((v) => v.category))

  const orderedCategories = ALLOWED_CATEGORIES.filter((cat) => usedCategories.has(cat))

  return ['全部', ...orderedCategories]
})

//当前页数
const currentPage = ref(1)
const pageSize = 10//每页放10个视频嘞

//把videos.value按分类要求过滤后给filteredVideos
const filteredVideos = computed(() => {
  if(currentCategory.value === '全部'){
    return videos.value
  }
  return videos.value.filter((v) => v.category === currentCategory.value)
})

//把按分类过滤的视频,按当前页从中切处需要的视频
const paginatedVideos = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredVideos.value.slice(start, end)
})

//当前选中分类的总页数
const totalPages = computed(() => {
  return Math.ceil(filteredVideos.value.length / pageSize)
})



//弹窗详情这一块
const selectedVideo = ref<Video|null>(null)

//打开弹窗
function openModal(video:Video){
  selectedVideo.value = video
}
//关闭弹窗
function closeModal(){
  selectedVideo.value = null
}




//当前选择分类变动时,就切到第一页(当前页面=1)
watch(currentCategory, () => {
  currentPage.value = 1
})


//把播放量改为以万为单位
function formatPlay(count: number): string{
  if(count >= 10000) return (count / 10000).toFixed(1) + '万'
  else return String(count)
}

function handleKeydown(e:KeyboardEvent){
  if(e.key === 'Escape' && selectedVideo.value){
    closeModal()
  }
}



//导出成csv的
function exportToCSV(){
  if(videos.value.length === 0) return

  //定义表头
  const headers = ['视频ID','标题','UP主','播放量','分类','链接']

  //每条数据转成逗号分隔行
  const rows = videos.value.map(v => [
    v.id,
    `"${v.title.replace(/"/g, '""')}"`,//正则处理自带逗号双引号
    v.upName,
    v.playCount,
    v.category,
    v.url
  ].join(','))

  //拼接整个文件内容(加个BOM头防止Excel乱码)
  const csvContent = '\uFeFF' + [headers.join(','), ...rows].join('\n')

  //生成Blob对象并触发下载
  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'})
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)//内存中出现临时下载链接
  link.download = `B站鬼畜数据_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(link.href)//释放掉内存
}

//准备图表数据的
//饼
const pieOption = computed<EChartsOption>(() => {
  const counts: Record<string, number> = {}
  filteredVideos.value.forEach(v => {
    counts[v.category] = (counts[v.category] || 0) + 1
  })

  const data = Object.keys(counts).map(key => ({
    name: key,
    value: counts[key]
  }))

  return {
    title: {
      text: '热梗分类占比',
      left: 'center',
    },
    tooltip: {trigger: 'item'},
    series: [{
      type: 'pie',
      radius: '50%',
      data: data,
    }]
  }
})
//柱
const barOption = computed<EChartsOption>(() => {
  const top10 = [...filteredVideos.value].sort((a,b) => b.playCount - a.playCount).slice(0, 10)

  return {
    title:{
      text:'播放量 TOP 10',
      left:'center'
    },
    tooltip:{trigger:'axis'},
    xAxis:{
      type:'category',
      data:top10.map(v => v.title.substring(0, 8) + '...'),//截断一下下不要太长
      axisLabel:{rotate: 30}//倾斜防重叠
    },
    yAxis:{type:'value'},
    series:[{
      type:'bar',
      data:top10.map(v => v.playCount),
      itemStyle:{color:'#5470c6'}
    }]
  }
})
//折线
const lineOption = computed<EChartsOption>(() => {
  const sorted = [...filteredVideos.value].sort((a,b) => b.playCount - a.playCount)

  return {
    title:{
      text:'播放量衰减曲线',
      left:'center'
    },
    tooltip:{trigger:'axis'},
    xAxis:{
      type:'category',
      data:sorted.map((_, index) => `No.${index + 1}`),
    },
    yAxis:{type:'value'},
    series:[{
      type:'line',
      data:sorted.map(v => v.playCount),
      smooth:true,
      areaStyle:{opacity: 0.2}
    }]
  }
})

//用封装axios成的request方法,拿到视频数据
onMounted(async () => {
  if(!localStorage.getItem('token')){
    console.log('未登录,跳过请求')
    return
  }


  try{
    videos.value = await request<Video[]>({url: '/videos', method: 'get'})
    lastUpdateTime.value = await request<string>({url: '/status', method: 'get'})
  }catch(err){
    //抓request.ts丢出来的错误
    console.error('请求失败', err)
  }
})

//用axios原生方法,后端连接测试用
onMounted(async () => {
  if(!localStorage.getItem('token')){
    console.log('未登录,跳过请求')
    return
  }

  try{
    const res = await axios.get('/api/health')
    message.value = JSON.stringify(res.data)
  }catch(err){
    message.value = '请求失败: ' + err
  }
})

//页面加载完就开始监听键盘
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
















<template>
  <div v-if="!token" class="login-box">
    <h2>请登录</h2>
    <input v-model="loginForm.username" placeholder="账号">
    <input v-model="loginForm.password" type="password" placeholder="密码">
    <button @click="handleLogin">登录</button>
  </div>

  <div v-else>
    <div>
      <h1>后端连接测试</h1>
      <p>{{ message }}</p>
    </div>

    <router-link to="/about">去关于页看看</router-link>


    <h1>B站视频列表</h1>

    <h4 v-if="lastUpdateTime">上次更新时间: {{ lastUpdateTime }}</h4>

    <button @click="exportToCSV" class="export-btn">📥 导出当前列表为 CSV</button>

    <!-- 整体信息 -->
    <div>
      <div class="card">视频总数:{{ totalCount }}</div>
      <div class="card">总播放量:{{ totalPlayCount }}</div>
      <div class="card">分类数量:{{ categoryCount }}</div>
    </div>

    <div 
    class="charts-raw" 
    style="display:flex; gap: 20px; margin-bottom: 20px;">
      <ChartBox :option="pieOption" style="flex: 1;"/>
      <ChartBox :option="barOption" style="flex: 1;"/>
    </div>
    <div 
    class="charts-raw" 
    style="margin-bottom: 20px;">
      <ChartBox :option="lineOption" style="width: 100%;"/>
    </div>


    <!-- 在v-for情况下,要写key来高效复用DOM树 -->

    <!-- 分类按钮 -->
    <div>
      <button
        v-for="cat in categoryButton"
        :key="cat"
        @click="currentCategory = cat"
        :class="{active: currentCategory === cat}"
      >
        {{ cat }}
      </button>
    </div>

    <p v-if = "videos.length === 0">加载中...</p>

    <!-- 显示视频的 -->
    <div class="video-list">
      <div 
        v-for="v in paginatedVideos" 
        :key="v.id" 
        class="video-card"
        @click="openModal(v)"
      >
        <h3>{{v.title}}</h3>
        <!-- 前端不发referrer,绕过拿图片的防盗链 -->
        <img :src = 'v.cover' referrerpolicy = 'no-referrer' width=320px height=180px>
        <p>UP主: {{v.upName }} | 播放量: {{ formatPlay(v.playCount) }}| 分类: {{ v.category }}</p>
      </div>
    </div>

    
    <!-- selectedVideo有值才渲染，点击外部遮罩就退出 -->
    <!-- 奶奶的,之前class名拼成closeModel了,排查半天 -->
    <div
      v-if="selectedVideo"
      class="modal-overlay"
      @click.self="closeModal" 
    >
      <div class="modal-content"> 
        <!-- 关闭按钮 -->
        <button class="close-btn" @click="closeModal">x</button>

        <img :src="selectedVideo.cover" referrerpolicy="no-referrer" class="model-cover" width=320px height=180px>
        <h2>{{ selectedVideo.title }}</h2>
        <iframe
          v-if="selectedVideo"
          :src="`//player.bilibili.com/player.html?bvid=${selectedVideo.id}&page=1&high_quality=1&danmaku=0`"
          scrolling="no"
          border="0"
          frameborder="no"
          framespacing="0"
          allow="fullscreen; autoplayl; encrypted-media; picture-in-picture"
          allowfullscreen
          class="bili-player"
          width="64%" 
          height="36%" 
        ></iframe>
        <p>UP主:{{ selectedVideo.upName }}</p>
        <p>播放量:{{ formatPlay(selectedVideo.playCount) }}</p>
        <p>分类:{{ selectedVideo.category }}</p>
        <p>简介:{{ selectedVideo.description || '暂无简介'}}</p>
        <p>标签:  {{ selectedVideo.tags?.join(' / ') || '无' }}</p>
        <p>(๑•̀ㅂ•́)و✧点赞:{{ selectedVideo.likeCount }} | (っ・ω・)っ◎投币:{{ selectedVideo.coinCount }} | (・∀・)ノ评论:{{ selectedVideo.replyCount }}</p>
        <a :href="selectedVideo.url" target="_blank">在B站打开</a>
      </div>
    </div>



    <!-- 下方切换页按钮的 -->
    <div class="pagination">
      <button @click="currentPage--" :disabled="currentPage === 1"><<<</button>
      <span>第{{ currentPage }}/{{ totalPages }}页</span>
      <button @click="currentPage++" :disabled="currentPage === totalPages">>>></button>
    </div>
  </div>
</template>
