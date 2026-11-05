<template>
    <div>
        <!-- 顶部页面加载进度条 -->
        <NuxtLoadingIndicator />
        <NuxtLayout>
            <!-- 全局页面过渡：fade 200ms，过渡类样式见 assets/css/main.css -->
            <NuxtPage :transition="{ name: 'fade', mode: 'out-in', duration: 200 }" />
        </NuxtLayout>
    </div>
</template>
