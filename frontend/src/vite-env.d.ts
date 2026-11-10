//用于防编辑标红，提前声明一下吼

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_PROXY_TARGET: string;
    readonly VITE_ENV_NAME: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}