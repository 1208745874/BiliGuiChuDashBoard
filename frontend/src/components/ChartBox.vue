<script setup lang="ts">
import {ref, onMounted, onUnmounted, watch} from 'vue'
import * as echarts from 'echarts'

//Props类型约束,要求父组件须一个叫option的对象
const props = defineProps<{
    option: echarts.EChartsOption
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let myChart: echarts.ECharts | null = null

onMounted(() => {
    if(chartRef.value){
        myChart = echarts.init(chartRef.value)
        myChart.setOption(props.option)
    }
    //监听窗口大小变化，让图标自适应
    window.addEventListener('resize', handleResize)
})


watch(() => props.option, (newOption) => {
    myChart?.setOption(newOption)
},{deep: true})


function handleResize(){
    myChart?.resize()
}


onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    myChart?.dispose()
})
</script>

<template>
    <div ref="chartRef" class="chart-container"></div>
</template>

<!-- scoped样式隔离 -->
<style scoped> 
.chart-container{
    width: 100%;
    height: 300px;
}
</style>