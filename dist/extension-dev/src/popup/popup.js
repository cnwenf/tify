// popup.js - 弹出窗口逻辑

class PopupController {
  constructor() {
    this.elements = {};
    this.settings = {};
    this.init();
  }

  // 初始化
  async init() {
    this.initElements();
    await this.loadSettings();
    this.bindEvents();
    this.updateUI();
    this.updateUsageStats();
  }

  // 初始化DOM元素
  initElements() {
    this.elements = {
      translateToggle: document.getElementById('translateToggle'),
      aiModel: document.getElementById('aiModel'),
      sourceLang: document.getElementById('sourceLang'),
      targetLang: document.getElementById('targetLang'),
      translateMode: document.getElementsByName('translateMode'),
      translatePageBtn: document.getElementById('translatePageBtn'),
      clearTranslationBtn: document.getElementById('clearTranslationBtn'),
      apiKey: document.getElementById('apiKey'),
      customEndpoint: document.getElementById('customEndpoint'),
      testApiBtn: document.getElementById('testApiBtn'),
      statusIndicator: document.getElementById('statusIndicator'),
      usageCount: document.getElementById('usageCount')
    };
  }

  // 加载设置
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'translateEnabled',
        'aiModel',
        'sourceLang',
        'targetLang',
        'translateMode',
        'apiKey',
        'customEndpoint',
        'usageCount'
      ]);

      this.settings = {
        translateEnabled: result.translateEnabled || false,
        aiModel: result.aiModel || 'openai-gpt35',
        sourceLang: result.sourceLang || 'auto',
        targetLang: result.targetLang || 'zh',
        translateMode: result.translateMode || 'bilingual',
        apiKey: result.apiKey || '',
        customEndpoint: result.customEndpoint || '',
        usageCount: result.usageCount || 0
      };
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 保存设置
  async saveSettings() {
    try {
      await chrome.storage.sync.set(this.settings);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }

  // 绑定事件
  bindEvents() {
    // 翻译开关
    this.elements.translateToggle.addEventListener('change', (e) => {
      this.settings.translateEnabled = e.target.checked;
      this.saveSettings();
      this.updateStatus();
      this.notifyContentScript();
    });

    // AI模型选择
    this.elements.aiModel.addEventListener('change', (e) => {
      this.settings.aiModel = e.target.value;
      this.saveSettings();
    });

    // 源语言选择
    this.elements.sourceLang.addEventListener('change', (e) => {
      this.settings.sourceLang = e.target.value;
      this.saveSettings();
    });

    // 目标语言选择
    this.elements.targetLang.addEventListener('change', (e) => {
      this.settings.targetLang = e.target.value;
      this.saveSettings();
    });

    // 翻译模式
    this.elements.translateMode.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.settings.translateMode = e.target.value;
          this.saveSettings();
        }
      });
    });

    // 翻译当前页面按钮
    this.elements.translatePageBtn.addEventListener('click', () => {
      this.translateCurrentPage();
    });

    // 清除翻译按钮
    this.elements.clearTranslationBtn.addEventListener('click', () => {
      this.clearTranslation();
    });

    // API Key输入
    this.elements.apiKey.addEventListener('change', (e) => {
      this.settings.apiKey = e.target.value;
      this.saveSettings();
    });

    // 自定义端点输入
    this.elements.customEndpoint.addEventListener('change', (e) => {
      this.settings.customEndpoint = e.target.value;
      this.saveSettings();
    });

    // 测试API按钮
    this.elements.testApiBtn.addEventListener('click', () => {
      this.testAPI();
    });
  }

  // 更新UI
  updateUI() {
    this.elements.translateToggle.checked = this.settings.translateEnabled;
    this.elements.aiModel.value = this.settings.aiModel;
    this.elements.sourceLang.value = this.settings.sourceLang;
    this.elements.targetLang.value = this.settings.targetLang;
    this.elements.apiKey.value = this.settings.apiKey;
    this.elements.customEndpoint.value = this.settings.customEndpoint;

    // 设置翻译模式
    this.elements.translateMode.forEach(radio => {
      radio.checked = radio.value === this.settings.translateMode;
    });

    this.updateStatus();
  }

  // 更新状态指示器
  updateStatus() {
    const statusDot = this.elements.statusIndicator.querySelector('.status-dot');
    const statusText = this.elements.statusIndicator.querySelector('.status-text');

    if (this.settings.translateEnabled) {
      statusDot.style.background = '#10b981';
      statusText.textContent = '已启用';
    } else {
      statusDot.style.background = '#6b7280';
      statusText.textContent = '已禁用';
    }
  }

  // 更新使用统计
  updateUsageStats() {
    this.elements.usageCount.textContent = `今日翻译: ${this.settings.usageCount} 次`;
  }

  // 翻译当前页面
  async translateCurrentPage() {
    try {
      this.setButtonLoading(this.elements.translatePageBtn, true);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'translatePage',
        settings: this.settings
      });

      // 增加使用计数
      this.settings.usageCount++;
      await this.saveSettings();
      this.updateUsageStats();

      this.showNotification('页面翻译已开始', 'success');
    } catch (error) {
      console.error('翻译页面失败:', error);
      this.showNotification('翻译失败，请重试', 'error');
    } finally {
      this.setButtonLoading(this.elements.translatePageBtn, false);
    }
  }

  // 清除翻译
  async clearTranslation() {
    try {
      this.setButtonLoading(this.elements.clearTranslationBtn, true);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'clearTranslation'
      });

      this.showNotification('翻译已清除', 'success');
    } catch (error) {
      console.error('清除翻译失败:', error);
      this.showNotification('清除失败，请重试', 'error');
    } finally {
      this.setButtonLoading(this.elements.clearTranslationBtn, false);
    }
  }

  // 测试API
  async testAPI() {
    if (!this.settings.apiKey) {
      this.showNotification('请先输入API Key', 'warning');
      return;
    }

    try {
      this.setButtonLoading(this.elements.testApiBtn, true);

      const response = await this.sendMessage({
        action: 'testAPI',
        settings: this.settings
      });

      if (response.success) {
        this.showNotification('API连接成功', 'success');
      } else {
        this.showNotification(response.error || 'API连接失败', 'error');
      }
    } catch (error) {
      console.error('测试API失败:', error);
      this.showNotification('API测试失败', 'error');
    } finally {
      this.setButtonLoading(this.elements.testApiBtn, false);
    }
  }

  // 通知内容脚本设置变更
  async notifyContentScript() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'settingsChanged',
        settings: this.settings
      });
    } catch (error) {
      // 内容脚本可能还未加载，忽略错误
      console.log('通知内容脚本失败:', error);
    }
  }

  // 发送消息到后台脚本
  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  // 设置按钮加载状态
  setButtonLoading(button, loading) {
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
      button.style.opacity = '0.7';
    } else {
      button.classList.remove('loading');
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  // 显示通知
  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      padding: '12px 16px',
      borderRadius: '6px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease',
      maxWidth: '300px'
    });

    // 根据类型设置背景色
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    notification.style.background = colors[type] || colors.info;

    document.body.appendChild(notification);

    // 动画显示
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 3秒后自动隐藏
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// 处理来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateUsageCount') {
    // 更新使用统计
    const controller = window.popupController;
    if (controller) {
      controller.settings.usageCount = message.count;
      controller.updateUsageStats();
    }
  }
});