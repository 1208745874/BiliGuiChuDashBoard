import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

import { fileURLToPath, URL } from 'node:url'


//在vite.config.ts加个检查逻辑
function validateEnv(env: Record<string, string>){
  const requiredVars = ['VITE_API_BASE_URL', 'VITE_PROXY_TARGET']
  const missing = requiredVars.filter((key) => !env[key])

  if(missing.length > 0){
    console.error('\n × 环境变量缺失,无法启动:')
    missing.forEach((key) => console.error(`  - ${key}`))
    console.error('请检查 frontend/.env 文件,补全后重新运行。\n')
    process.exit(1)
  }
}


export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd())

  //执行检查
  validateEnv(env)

  return {
    plugins: [vue()],

    resolve: {
      alias:{
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },

    server: {
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  }
})
