// 1. 你的 Worker 统一地址 (记得换成你的自定义域名！)
const API_URL = 'https://api.ethan929.top'; 

const CONFIG = {
    bilibiliUid: '1863501530',
    youtubeId: 'UCHQaIJJW0WAZkCqee3t67uw'
};

/**
 * 通用渲染函数
 * @param {string} platform - 平台名
 * @param {string} urlParams - 额外参数
 * @param {object} idMap - { 页面元素ID: 对应的数据字段名 }
 */
async function updateStats(platform, urlParams, idMap) {
    try {
        const response = await fetch(`${API_URL}/?platform=${platform}&${urlParams}`);
        const data = await response.json();
        
        for (const [elementId, dataField] of Object.entries(idMap)) {
            const el = document.getElementById(elementId);
            if (el && data[dataField] !== undefined) {
                let value = parseInt(data[dataField]);

                // === 核心逻辑：只对小红书的点赞 ID 生效 ===
                if (elementId === 'count-xhs-likes' && value >= 1000) {
                    // 将数值除以 1000，取整数，拼接 k
                    el.innerText = (value / 1000) + 'k';
                } else {
                    // 默认显示逻辑
                    el.innerText = value.toLocaleString();
                }
                
            } else if (el) {
                el.innerText = '0';
            }
        }
    } catch (error) {
        console.error(`${platform} 获取失败:`, error);
    }
}

// ================= 页面执行 =================

// B 站：一次性更新三个指标
updateStats('bilibili', `uid=${CONFIG.bilibiliUid}`, {
    'count-bili-fans': 'fans',
    'count-bili-videos': 'videos',
    'count-bili-likes': 'likes'
});

// YouTube：保持原有，这里假设你 Workers 里也返回了 videos/likes
updateStats('youtube', `id=${CONFIG.youtubeId}`, {
    'count-youtube-fans': 'fans',
    'count-youtube-videos': 'videos',
    'count-youtube-views': 'views'
});

// 小红书：根据你的 KV 存的内容更新
updateStats('xiaohongshu', '', {
    'count-xhs-fans': 'fans',
    'count-xhs-notes': 'notes',
    'count-xhs-likes': 'likes'
});