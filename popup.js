// 弹出窗口脚本
document.addEventListener('DOMContentLoaded', function() {
    const protectionIndicator = document.getElementById('protectionIndicator');
    const protectionStatus = document.getElementById('protectionStatus');
    const savedImages = document.getElementById('savedImages');
    const restoredImages = document.getElementById('restoredImages');
    const manualRestoreBtn = document.getElementById('manualRestore');
    const refreshImagesBtn = document.getElementById('refreshImages');
    
    // 获取当前标签页
    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }
    
    // 更新状态显示
    function updateStatus(isActive, saved = 0, restored = 0) {
        if (isActive) {
            protectionIndicator.className = 'indicator active';
            protectionStatus.textContent = '已激活';
        } else {
            protectionIndicator.className = 'indicator inactive';
            protectionStatus.textContent = '未激活';
        }
        
        savedImages.textContent = saved;
        restoredImages.textContent = restored;
    }
    
    // 向内容脚本发送消息
    async function sendMessageToContent(message) {
        try {
            const tab = await getCurrentTab();
            return await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
            console.error('发送消息失败:', error);
            return null;
        }
    }
    
    // 手动恢复图片
    manualRestoreBtn.addEventListener('click', async function() {
        this.textContent = '恢复中...';
        this.disabled = true;
        
        const result = await sendMessageToContent({ action: 'manualRestore' });
        
        setTimeout(() => {
            this.textContent = '手动恢复';
            this.disabled = false;
            
            if (result) {
                updateStatus(true, result.saved || 0, result.restored || 0);
            }
        }, 1000);
    });
    
    // 刷新扫描图片
    refreshImagesBtn.addEventListener('click', async function() {
        this.textContent = '扫描中...';
        this.disabled = true;
        
        const result = await sendMessageToContent({ action: 'refreshScan' });
        
        setTimeout(() => {
            this.textContent = '刷新扫描';
            this.disabled = false;
            
            if (result) {
                updateStatus(true, result.saved || 0, result.restored || 0);
            }
        }, 1000);
    });
    
    // 初始化状态
    async function initStatus() {
        const result = await sendMessageToContent({ action: 'getStatus' });
        if (result) {
            updateStatus(result.isActive, result.saved, result.restored);
        } else {
            updateStatus(false);
        }
    }
    
    // 页面加载时初始化
    initStatus();
    
    // 定期更新状态
    setInterval(initStatus, 2000);
});