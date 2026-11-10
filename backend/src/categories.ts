//后端：限制AI挑选的分类范围
//前端：分类按钮排序顺序

export const ALLOWED_CATEGORIES = [
    '哲学',
    '念诗',
    'RAP',
    '鬼畜调音',
    '音MAD',
    '鬼畜剧场',
    '全明星',
    '其他',
] as const

export type CategoryName = typeof ALLOWED_CATEGORIES[number]