//统一响应格式

// 视频
export interface Video {
  id: string            // 视频唯一标识，B 站 BV 号
  title: string         // 标题
  upName: string        // UP 主名字
  playCount: number     // 播放量
  url: string           // 视频链接
  cover: string         // 封面图地址
  category: string      // 热梗分类，如“哲学”
  pubdate: number       // 发布时间（时间戳）

  // 详情页新增字段（可选，因为不是所有场景都需要）
  description?: string
  tags?: string[]
  replyCount?: number
  coinCount?: number
  danmakuCount?: number
  likeCount?: number
  favoriteCount?: number
  shareCount?: number
}

// 分类统计
export interface Category {
  name: string          // 分类名
  count: number         // 该分类下视频数量
}

// 统一 API 响应格式
export interface APIResponse<T> {
  code: number          // 0 表示成功，非 0 表示失败
  message: string       // 提示信息
  data: T               // 真正的数据，类型由调用方决定
}