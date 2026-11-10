import OpenAI from 'openai'
import { searchBilibili, searchMemeWiki } from './agentTools'
import type{Video} from './types' 


//初始化客户端(DeepSeek兼容OpenAI SDK的)
const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
})

//工具(说明书)
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'search_bilibili',
            description: '根据关键词搜索B站鬼畜视频,返回视频列表',
            parameters: {
                type: 'object',
                properties: {
                    keyword: {
                        type: 'string',
                        description: '根据关键词搜索B站鬼畜视频。注意：本地视频库较小，请尽量使用单个精准的短语搜索（如“马保国”、“鸡你太美”），不要输入带空格的组合词'
                    },
                },
                required: ['keyword'],
            },
        },
    },    
    {
        type: 'function',
        function: {
            name: 'search_meme_wiki',
            description: '查询热梗百科，了解某个鬼畜分类或梗的背景来源',
            parameters: {
                type: 'object',
                properties:{
                    memeName: {
                        type: 'string',
                        description: '热梗名称，比如 哲学、全明星'
                    },
                },
                required: ['memeName'],
            },
        },
    },
]

//封装Agent接口
export async function executeAgent(
    systemPrompt: string,
    userPrompt: string,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[], 
    cachedVideos: Video[],
){
    const messages:any[] = [
        {
            role: 'system',
            content: systemPrompt,
        },
        {
            role: 'user',
            content: userPrompt,
        }
    ] 

    //限制思考轮次
    for(let i = 0; i < 8; i++){
        console.log(`---第${i+1}轮思考---`)

        const response = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: messages,
            ...(tools && tools.length > 0 ? { tools } : {})
        })

        const responseMessage = response.choices[0]?.message

        //1、模型没有调用工具，说明想清楚了，直接返回结果
        if(!responseMessage?.tool_calls || responseMessage?.tool_calls.length === 0){
            console.log('思考结束，生成最终报告')
            return responseMessage?.content || '抱歉，大模型未能生成分析报告。'
        }

        //2、模型要调用工具
        messages.push(responseMessage)//存进对话历史

        for(const toolCall of responseMessage.tool_calls){
            //让下面那俩const别报红
            if (toolCall.type !== 'function') {
                continue;
            }

            const functionName = toolCall.function.name
            const functionArgs =JSON.parse(toolCall.function.arguments)

            console.log(`模型请求调用工具：${functionName},参数：`, functionArgs)

            let toolResult: any

            if(functionName === 'search_bilibili'){
                toolResult = await searchBilibili(functionArgs.keyword, cachedVideos)
            }else if(functionName === 'search_meme_wiki'){
                toolResult = await searchMemeWiki(functionArgs.memeName)
            }else{
                toolResult = '未知的工具'
            }

            console.log('工具执行结果:',toolResult)

            messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            })
        }
    }

    return '执行超时'
}


export async function runMultiAgent(question: string, cachedVideos: Video[]){
    const collectorTools = tools.find(t => t.type === 'function'&& t.function.name === 'search_bilibili'); // 采集员只有搜索
    const analystTools = tools.find(t => t.type === 'function'&& t.function.name === 'search_meme_wiki');   // 分析师只有百科
    const reporterTools: OpenAI.Chat.Completions.ChatCompletionTool[] = []; // 报告员没工具


    console.log('---采集Agent开始工作---')
    const collectorResult = await executeAgent(
        '你是一个无情的B站数据采集员。你的任务是根据用户的问题，调用工具搜索视频。请把搜到的视频标题、UP主、分类等原始数据罗列出来，不要做过多的主观分析。',
        question,
        collectorTools? [collectorTools]: [],
        cachedVideos,
    )
    console.log('采集完成,结果长度:', collectorResult?.length)


    console.log('---分析Agent开始工作---')
    const analystResult = await executeAgent(
        '你是一个资深的鬼畜区热梗分析师。你会收到采集员发来的原始数据。请根据这些视频数据，调用百科工具了解梗的背景，然后深入分析这些视频为什么火、属于什么流派。',
        `这是采集员找来的数据：\n${collectorResult}\n\n请基于以上数据进行分析。`,
        analystTools? [analystTools]: [], // 只给它 search_meme_wiki 工具
        cachedVideos
    )
    console.log('分析完成，结果长度：', analystResult?.length)

    console.log('---报告Agent开始工作---')
    const reportResult = await executeAgent(
        '你是一个专业的报告排版员。请根据分析师给出的内容，写一篇精美的、结构化的分析报告，使用 Markdown 格式，包含一二级标题和加粗列表。不要自己瞎编数据。',
        `这是分析师的结论：\n${analystResult}\n\n请生成最终报告。`,
        [],
        cachedVideos
    )
    console.log('报告生成完毕')

    return reportResult

}