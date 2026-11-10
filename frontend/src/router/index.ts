import {createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'Dashboard',
            //component动态导入的，只有访问/路径时才会去请求Dashboard.vue文件
            component: () => import('@/views/Dashboard.vue')
        },
        {
            path: '/about',
            name: 'About',
            component: () => import('@/views/About.vue')
        },
    ],
})

export default router