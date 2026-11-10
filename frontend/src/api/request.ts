import axios from 'axios'
import type { APIResponse } from '@/types'

import {type AxiosRequestConfig} from 'axios'

const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 10000
})

instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if(token){
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

//拦截器把数据处理一下 + 处理401
instance.interceptors.response.use(
    (response) => {
        const body = response.data as APIResponse<unknown>
        if(body.code !== 0){
            return Promise.reject(new Error(body.message))
        }
        return body.data as any
    },

    (error) => {
        if(error.response && error.response.status === 401){
            localStorage.removeItem('token')

            const isLoginRequest = error.config.url?.includes('/auth/login')
            if(!isLoginRequest){
                window.location.reload()//弄回登录页
            }
        }
        return Promise.reject(error)
    }
)

export function request<T>(config: AxiosRequestConfig): Promise<T>{
    return instance.request(config) as unknown as Promise<T>
}

