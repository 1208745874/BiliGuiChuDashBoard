//从B站拿到数据

interface RankingItem {
    bvid: string
    title: string
    pic: string
    pubdate: number
    owner: {
        name: string
    }
    stat: {
        view: number
    }

}

interface RankingResponse {
    code: number
    message: string
    data: {
        list: RankingItem[]
    }
}

interface VideoTagItem {
    tag_name: string
}

interface VideoDetailResponse{
    code: number
    data: {
        View:{
            desc: string
            stat: {
                reply: number
                coin: number
                danmaku: number
                like: number
                favorite: number
                share: number
            }
        }
        Tags: VideoTagItem[]
    }
    
}


import axios from 'axios'
import type { Video } from './types'

const RANKING_URL = 'https://api.bilibili.com/x/web-interface/ranking/v2'

export async function fetchRankingVideos(): Promise<Video[]> {
    const res = await axios.get<RankingResponse>(
        RANKING_URL,
        {
            params:{
                rid: 1007,
                type: 'all',
            },
            headers:{
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',//伪装浏览器
                'Referer': 'https://www.bilibili.com/',//伪装来源
            }
        }
    )

    if(res.data.code !== 0){
        throw new Error(`B站接口返回错误: code=${res.data.code}, message=${res.data.message}`)
    }

    return res.data.data.list.map(item => ({
        id: item.bvid,
        title: item.title,
        upName: item.owner.name,
        playCount: item.stat.view,
        url: `https://www.bilibili.com/video/${item.bvid}`,
        cover: item.pic,
        category: '',
        pubdate: item.pubdate,
    }))
}

const DETAIL_URL = 'https://api.bilibili.com/x/web-interface/view/detail'

export async function fetchVideoDetail(bvid: string): Promise<Partial<Video>>{
    const res = await axios.get<VideoDetailResponse>(
        DETAIL_URL,
        {
            params: {bvid},
            headers: {
                'User-Agent': 'Mozilla/5.0 ...',
                'Referer': 'https://www.bilibili.com/',
            },
        }
    )

    if(res.data.code !== 0){
        throw new Error(`详情接口错误: code=${res.data.code}`)
    }

    const detail = res.data.data

    const view = detail.View
    const tags = detail.Tags
    return {
        description: view.desc,
        tags: tags?.map((t) => t.tag_name) ?? [],
        replyCount: view.stat.reply,
        coinCount: view.stat.coin,
        danmakuCount: view.stat.danmaku,
        likeCount: view.stat.like,
        favoriteCount: view.stat.favorite,
        shareCount: view.stat.share,
    }
}