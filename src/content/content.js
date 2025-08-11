// content.js - 内容脚本：处理网页翻译

class TranslationController {
  constructor() {
    this.settings = {};
    this.translatedElements = new Map();
    this.floatButton = null;
    this.isTranslating = false;
    this.selectionMode = false;
    
    this.init();
  }

  // 初始化
  async init() {
    await this.loadSettings();
    this.createFloatButton();
    this.bindEvents();
    this.setupSelectionTranslation();
    
    // 监听设置变化
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }

  // 加载设置
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'translateEnabled',
        'aiModel',
        'sourceLang',
        'targetLang',
        'translateMode'
      ]);

      this.settings = {
        translateEnabled: result.translateEnabled || false,
        aiModel: result.aiModel || 'openai-gpt35',
        sourceLang: result.sourceLang || 'auto',
        targetLang: result.targetLang || 'zh',
        translateMode: result.translateMode || 'bilingual'
      };
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 处理消息
  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'translatePage':
        this.translatePage(message.settings);
        sendResponse({ success: true });
        break;
      case 'clearTranslation':
        this.clearTranslation();
        sendResponse({ success: true });
        break;
      case 'settingsChanged':
        this.settings = message.settings;
        this.updateFloatButton();
        sendResponse({ success: true });
        break;
      case 'toggleTranslation':
        this.toggleTranslation();
        sendResponse({ success: true });
        break;
    }
  }

  // 创建悬浮按钮
  createFloatButton() {
    // 检查是否已存在
    if (document.getElementById('ai-translator-float-btn')) {
      return;
    }

    this.floatButton = document.createElement('div');
    this.floatButton.id = 'ai-translator-float-btn';
    this.floatButton.innerHTML = `
      <div class="float-btn-container">
        <div class="float-btn-icon">🌐</div>
        <div class="float-btn-tooltip">AI翻译</div>
      </div>
    `;

    // 添加样式
    this.floatButton.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      z-index: 10000;
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border-radius: 50%;
      box-shadow: 0 4px 20px rgba(79, 70, 229, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      transition: all 0.3s ease;
      transform: translateY(-50%);
      user-select: none;
    `;

    // 添加悬停效果
    this.floatButton.addEventListener('mouseenter', () => {
      this.floatButton.style.transform = 'translateY(-50%) scale(1.1)';
      this.floatButton.style.boxShadow = '0 6px 25px rgba(79, 70, 229, 0.4)';
    });

    this.floatButton.addEventListener('mouseleave', () => {
      this.floatButton.style.transform = 'translateY(-50%) scale(1)';
      this.floatButton.style.boxShadow = '0 4px 20px rgba(79, 70, 229, 0.3)';
    });

    // 点击事件
    this.floatButton.addEventListener('click', () => {
      this.toggleTranslation();
    });

    document.body.appendChild(this.floatButton);
    this.updateFloatButton();
  }

  // 更新悬浮按钮状态
  updateFloatButton() {
    if (!this.floatButton) return;

    const icon = this.floatButton.querySelector('.float-btn-icon');
    if (this.settings.translateEnabled) {
      icon.textContent = '✓';
      this.floatButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    } else {
      icon.textContent = '🌐';
      this.floatButton.style.background = 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)';
    }
  }

  // 绑定事件
  bindEvents() {
    // 快捷键支持
    document.addEventListener('keydown', (e) => {
      // Alt + A: 切换翻译
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        this.toggleTranslation();
      }
      
      // Alt + W: 翻译整个页面
      if (e.altKey && e.key === 'w') {
        e.preventDefault();
        this.translatePage();
      }
    });

    // 右键菜单支持（通过background script处理）
    document.addEventListener('contextmenu', (e) => {
      // 记录右键位置，用于可能的翻译操作
      this.lastContextMenuPosition = { x: e.clientX, y: e.clientY };
    });
  }

  // 设置选择翻译
  setupSelectionTranslation() {
    let selectionTimeout;

    document.addEventListener('mouseup', () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        if (selection.toString().trim().length > 0) {
          this.showSelectionButton(selection);
        } else {
          this.hideSelectionButton();
        }
      }, 200);
    });

    document.addEventListener('mousedown', () => {
      this.hideSelectionButton();
    });
  }

  // 显示选择翻译按钮
  showSelectionButton(selection) {
    if (!this.settings.translateEnabled) return;

    this.hideSelectionButton();

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const button = document.createElement('div');
    button.id = 'ai-translator-selection-btn';
    button.innerHTML = '翻译';
    
    button.style.cssText = `
      position: fixed;
      top: ${rect.top - 40}px;
      left: ${rect.left + rect.width / 2 - 30}px;
      width: 60px;
      height: 30px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: white;
      border: none;
      border-radius: 15px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.translateSelection(selection.toString());
      this.hideSelectionButton();
    });

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    document.body.appendChild(button);
  }

  // 隐藏选择翻译按钮
  hideSelectionButton() {
    const existing = document.getElementById('ai-translator-selection-btn');
    if (existing) {
      existing.remove();
    }
  }

  // 切换翻译状态
  async toggleTranslation() {
    if (this.isTranslating) {
      this.clearTranslation();
    } else {
      await this.translatePage();
    }
  }

  // 翻译页面
  async translatePage(settings = null) {
    if (this.isTranslating) return;

    try {
      this.isTranslating = true;
      this.showProgress('正在翻译页面...');

      const currentSettings = settings || this.settings;
      
      // 获取需要翻译的文本元素
      const elements = this.getTranslatableElements();
      
      if (elements.length === 0) {
        this.showNotification('未找到可翻译的内容', 'warning');
        return;
      }

      // 批量翻译
      const batchSize = 5; // 每批翻译5个元素
      for (let i = 0; i < elements.length; i += batchSize) {
        const batch = elements.slice(i, i + batchSize);
        await this.translateBatch(batch, currentSettings);
        
        // 更新进度
        const progress = Math.round(((i + batch.length) / elements.length) * 100);
        this.updateProgress(`翻译进度: ${progress}%`);
      }

      this.hideProgress();
      this.showNotification('页面翻译完成', 'success');
      
    } catch (error) {
      console.error('翻译失败:', error);
      this.showNotification('翻译失败，请重试', 'error');
    } finally {
      this.isTranslating = false;
    }
  }

  // 翻译选中文本
  async translateSelection(text) {
    if (!text.trim()) return;

    try {
      this.showProgress('正在翻译选中内容...');

      const translation = await this.requestTranslation(text, this.settings);
      
      if (translation) {
        this.showTranslationPopup(text, translation);
      }

    } catch (error) {
      console.error('翻译选中文本失败:', error);
      this.showNotification('翻译失败', 'error');
    } finally {
      this.hideProgress();
    }
  }

  // 获取可翻译的元素
  getTranslatableElements() {
    const selector = 'p, h1, h2, h3, h4, h5, h6, li, td, th, div, span, a, button, label, input[type="text"], textarea';
    const elements = document.querySelectorAll(selector);
    
    return Array.from(elements).filter(el => {
      // 过滤条件
      if (el.offsetParent === null) return false; // 不可见元素
      if (el.querySelector('script, style, noscript')) return false; // 包含脚本的元素
      if (el.closest('script, style, noscript, code, pre')) return false; // 在脚本内的元素
      if (el.hasAttribute('data-ai-translated')) return false; // 已翻译的元素
      
      const text = el.textContent.trim();
      if (text.length < 3) return false; // 文本太短
      if (!/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\u1100-\u11ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff\u1f00-\u1fff\u2000-\u206f\u2e00-\u2e7f\ua720-\ua7ff\uab00-\uabbf\ufb00-\ufb4f\u0100-\u017f\u1e00-\u1eff]|[a-zA-Z]/.test(text)) return false; // 不包含字母或其他语言字符
      
      return true;
    });
  }

  // 批量翻译
  async translateBatch(elements, settings) {
    const promises = elements.map(async (element) => {
      try {
        const originalText = element.textContent.trim();
        if (!originalText) return;

        const translation = await this.requestTranslation(originalText, settings);
        
        if (translation) {
          this.applyTranslation(element, originalText, translation, settings.translateMode);
        }
      } catch (error) {
        console.error('翻译元素失败:', error);
      }
    });

    await Promise.all(promises);
  }

  // 请求翻译
  async requestTranslation(text, settings) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'translate',
        text: text,
        settings: settings
      }, (response) => {
        if (response && response.success) {
          resolve(response.translation);
        } else {
          resolve(null);
        }
      });
    });
  }

  // 应用翻译
  applyTranslation(element, originalText, translation, mode) {
    // 标记为已翻译
    element.setAttribute('data-ai-translated', 'true');
    element.setAttribute('data-original-text', originalText);

    if (mode === 'bilingual') {
      // 双语对照模式
      const translationEl = document.createElement('div');
      translationEl.className = 'ai-translation-bilingual';
      translationEl.innerHTML = `
        <div class="original-text">${originalText}</div>
        <div class="translated-text">${translation}</div>
      `;
      
      translationEl.style.cssText = `
        border-left: 3px solid #4f46e5;
        padding-left: 8px;
        margin: 4px 0;
        background: rgba(79, 70, 229, 0.05);
        border-radius: 4px;
      `;

      element.innerHTML = '';
      element.appendChild(translationEl);
    } else {
      // 替换模式
      element.innerHTML = `<span class="ai-translation-replace" title="原文: ${originalText}">${translation}</span>`;
    }

    // 记录翻译
    this.translatedElements.set(element, { originalText, translation, mode });
  }

  // 清除翻译
  clearTranslation() {
    // 恢复所有翻译的元素
    this.translatedElements.forEach((data, element) => {
      element.textContent = data.originalText;
      element.removeAttribute('data-ai-translated');
      element.removeAttribute('data-original-text');
    });

    this.translatedElements.clear();

    // 清除选择按钮
    this.hideSelectionButton();

    // 清除翻译弹窗
    this.hideTranslationPopup();

    this.showNotification('翻译已清除', 'info');
  }

  // 显示翻译弹窗
  showTranslationPopup(originalText, translation) {
    this.hideTranslationPopup();

    const popup = document.createElement('div');
    popup.id = 'ai-translator-popup';
    popup.innerHTML = `
      <div class="popup-header">
        <span class="popup-title">AI 翻译结果</span>
        <button class="popup-close">&times;</button>
      </div>
      <div class="popup-content">
        <div class="popup-section">
          <label>原文:</label>
          <div class="popup-text">${originalText}</div>
        </div>
        <div class="popup-section">
          <label>译文:</label>
          <div class="popup-text translated">${translation}</div>
        </div>
      </div>
      <div class="popup-actions">
        <button class="popup-btn copy-btn">复制译文</button>
        <button class="popup-btn close-btn">关闭</button>
      </div>
    `;

    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 10002;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      #ai-translator-popup .popup-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        border-radius: 12px 12px 0 0;
      }
      
      #ai-translator-popup .popup-title {
        font-weight: 600;
        font-size: 16px;
      }
      
      #ai-translator-popup .popup-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      }
      
      #ai-translator-popup .popup-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      #ai-translator-popup .popup-content {
        padding: 20px;
      }
      
      #ai-translator-popup .popup-section {
        margin-bottom: 16px;
      }
      
      #ai-translator-popup .popup-section label {
        display: block;
        font-weight: 500;
        margin-bottom: 8px;
        color: #374151;
        font-size: 14px;
      }
      
      #ai-translator-popup .popup-text {
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        line-height: 1.6;
        font-size: 14px;
        color: #1f2937;
        border: 1px solid #e5e7eb;
      }
      
      #ai-translator-popup .popup-text.translated {
        background: #f0f9ff;
        border-color: #0ea5e9;
      }
      
      #ai-translator-popup .popup-actions {
        padding: 16px 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      
      #ai-translator-popup .popup-btn {
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        color: #374151;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      #ai-translator-popup .popup-btn:hover {
        background: #f9fafb;
      }
      
      #ai-translator-popup .copy-btn {
        background: #4f46e5;
        color: white;
        border-color: #4f46e5;
      }
      
      #ai-translator-popup .copy-btn:hover {
        background: #4338ca;
      }
    `;
    
    document.head.appendChild(style);

    // 事件绑定
    popup.querySelector('.popup-close').addEventListener('click', () => {
      this.hideTranslationPopup();
    });

    popup.querySelector('.close-btn').addEventListener('click', () => {
      this.hideTranslationPopup();
    });

    popup.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(translation).then(() => {
        this.showNotification('译文已复制到剪贴板', 'success');
      });
    });

    // 点击背景关闭
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        this.hideTranslationPopup();
      }
    });

    document.body.appendChild(popup);
  }

  // 隐藏翻译弹窗
  hideTranslationPopup() {
    const popup = document.getElementById('ai-translator-popup');
    if (popup) {
      popup.remove();
    }
  }

  // 显示进度
  showProgress(message) {
    this.hideProgress();

    const progress = document.createElement('div');
    progress.id = 'ai-translator-progress';
    progress.innerHTML = `
      <div class="progress-content">
        <div class="progress-spinner"></div>
        <div class="progress-text">${message}</div>
      </div>
    `;

    progress.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 10003;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #374151;
    `;

    // 添加旋转动画样式
    const style = document.createElement('style');
    style.textContent = `
      #ai-translator-progress .progress-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #e5e7eb;
        border-top: 2px solid #4f46e5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(progress);
  }

  // 更新进度
  updateProgress(message) {
    const progress = document.getElementById('ai-translator-progress');
    if (progress) {
      progress.querySelector('.progress-text').textContent = message;
    }
  }

  // 隐藏进度
  hideProgress() {
    const progress = document.getElementById('ai-translator-progress');
    if (progress) {
      progress.remove();
    }
  }

  // 显示通知
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `ai-translator-notification notification-${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      z-index: 10004;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    notification.style.background = colors[type] || colors.info;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// 初始化翻译控制器
const translationController = new TranslationController();