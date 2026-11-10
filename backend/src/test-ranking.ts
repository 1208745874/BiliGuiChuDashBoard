//测试程序，待删除

import { fetchRankingVideos } from './bilibili'

async function main() {
  const videos = await fetchRankingVideos()
  console.log('共拿到', videos.length, '条')
  console.log('第一条：', videos[0])
  console.log('最后一条：', videos[videos.length - 1])
}

main().catch((err) => {
  console.error('失败：', err.message)
})