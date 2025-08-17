// content.js - 内容脚本：处理网页翻译

class TranslationController {
  constructor() {
    this.settings = {};
    this.translatedElements = new Map();
    this.floatButton = null;
    this.isTranslating = false;
    this.selectionMode = false;
    this.extensionCheckInterval = null;
    this.concurrencyLimit = 5; // 并发限制
    this.translationQueue = []; // 翻译队列
    this.activeTranslations = 0; // 当前活跃的翻译数量
    
    // 延迟初始化，确保DOM已加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
      });
    } else {
      this.init();
    }
  }

  // 初始化
  async init() {
    console.log('Tidy: 初始化翻译控制器');
    
    // 检查扩展上下文是否有效
    if (!chrome.runtime?.id) {
      console.error('Tidy: 扩展上下文无效，无法初始化');
      return;
    }
    
    try {
      await this.loadSettings();
      this.createFloatButton();
      this.bindEvents();
      this.setupSelectionTranslation();
      
      // 监听设置变化
      try {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          console.log('Tidy: 收到消息:', message);
          this.handleMessage(message, sender, sendResponse);
        });
      } catch (error) {
        console.error('Tidy: 设置消息监听器失败:', error);
      }
      
      // 监听扩展状态变化
      this.setupExtensionStateListener();
      
      console.log('Tidy: 翻译控制器初始化完成');
      console.log('Tidy: 当前设置:', this.settings);
    } catch (error) {
      console.error('Tidy: 初始化失败:', error);
      this.showNotification('初始化失败，请刷新页面重试', 'error');
    }
  }

  // 设置扩展状态监听器
  setupExtensionStateListener() {
    // 定期检查扩展上下文是否有效
    this.extensionCheckInterval = setInterval(() => {
      if (!chrome.runtime?.id) {
        console.warn('Tidy: 检测到扩展上下文失效，尝试重新初始化');
        this.handleExtensionContextInvalidated();
      }
    }, 30000); // 每30秒检查一次
  }

  // 移除事件监听器
  removeEventListeners() {
    // 移除键盘事件监听器
    if (this.boundKeydownHandler) {
      document.removeEventListener('keydown', this.boundKeydownHandler);
    }
    if (this.boundMouseupHandler) {
      document.removeEventListener('mouseup', this.boundMouseupHandler);
    }
    if (this.boundMousedownHandler) {
      document.removeEventListener('mousedown', this.boundMousedownHandler);
    }
    if (this.boundContextmenuHandler) {
      document.removeEventListener('contextmenu', this.boundContextmenuHandler);
    }
    
    // 移除悬浮按钮事件监听器
    if (this.floatButton) {
      if (this.boundFloatButtonMouseenter) {
        this.floatButton.removeEventListener('mouseenter', this.boundFloatButtonMouseenter);
      }
      if (this.boundFloatButtonMouseleave) {
        this.floatButton.removeEventListener('mouseleave', this.boundFloatButtonMouseleave);
      }
      if (this.boundFloatButtonClick) {
        this.floatButton.removeEventListener('click', this.boundFloatButtonClick);
      }
    }
  }

  // 清理资源
  cleanup() {
    console.log('Tidy: 开始清理资源...');
    
    // 停止翻译
    this.isTranslating = false;
    
    // 清除翻译
    this.clearTranslation();
    
    // 隐藏选择按钮
    this.hideSelectionButton();
    
    // 移除事件监听器
    this.removeEventListeners();
    
    // 停止定期检查
    if (this.extensionCheckInterval) {
      clearInterval(this.extensionCheckInterval);
      this.extensionCheckInterval = null;
    }
    
    // 移除悬浮按钮
    if (this.floatButton && this.floatButton.parentNode) {
      this.floatButton.parentNode.removeChild(this.floatButton);
      this.floatButton = null;
    }
    
    console.log('Tidy: 资源清理完成');
  }

  // 处理扩展上下文失效
  handleExtensionContextInvalidated() {
    console.warn('Tidy: 扩展上下文已失效，开始清理...');
    
    // 清理现有元素
    this.clearTranslation();
    this.hideSelectionButton();
    
    // 移除悬浮按钮
    if (this.floatButton && this.floatButton.parentNode) {
      this.floatButton.parentNode.removeChild(this.floatButton);
      this.floatButton = null;
    }
    
    // 移除所有相关的事件监听器
    this.removeEventListeners();
    
    // 显示提示信息
    this.showNotification('扩展上下文已失效，请刷新页面重试', 'warning');
    
    // 停止定期检查
    if (this.extensionCheckInterval) {
      clearInterval(this.extensionCheckInterval);
      this.extensionCheckInterval = null;
    }
    
    // 尝试重新初始化
    setTimeout(() => {
      if (chrome.runtime?.id) {
        console.log('Tidy: 扩展上下文已恢复，重新初始化');
        this.init();
      }
    }, 2000);
  }

  // 加载设置
  async loadSettings() {
    try {
      // 检查扩展上下文是否有效
      if (!chrome.runtime?.id || !chrome.storage) {
        console.error('Tidy: 扩展上下文无效，使用默认设置');
        this.settings = {
          translateEnabled: false,
          aiModel: 'openai-gpt35',
          sourceLang: 'auto',
          targetLang: 'zh',
          translateMode: 'immersive-bilingual'
        };
        return;
      }

      const result = await chrome.storage.sync.get([
        'translateEnabled',
        'aiModel',
        'sourceLang',
        'targetLang',
        'translateMode',
        'apiKey',
        'customEndpoint'
      ]);

      this.settings = {
        translateEnabled: result.translateEnabled || false,
        aiModel: result.aiModel || 'openai-gpt35',
        sourceLang: result.sourceLang || 'auto',
        targetLang: result.targetLang || 'zh',
        translateMode: result.translateMode || 'immersive-bilingual',
        apiKey: result.apiKey || '',
        customEndpoint: result.customEndpoint || ''
      };
    } catch (error) {
      console.error('Tidy: 加载设置失败:', error);
      // 使用默认设置
      this.settings = {
        translateEnabled: false,
        aiModel: 'openai-gpt35',
        sourceLang: 'auto',
        targetLang: 'zh',
        translateMode: 'immersive-bilingual'
      };
    }
  }

  // 处理消息
  handleMessage(message, sender, sendResponse) {
    console.log('Tidy: 处理消息:', message.action);
    
    switch (message.action) {
      case 'translatePage':
        console.log('Tidy: 开始翻译页面');
        this.translatePage(message.settings);
        sendResponse({ success: true });
        break;
      case 'clearTranslation':
        console.log('Tidy: 清除翻译');
        this.clearTranslation();
        sendResponse({ success: true });
        break;
      case 'settingsChanged':
        console.log('Tidy: 设置已更新');
        this.settings = message.settings;
        this.updateFloatButton();
        sendResponse({ success: true });
        break;
      case 'toggleTranslation':
        console.log('Tidy: 切换翻译状态');
        this.toggleTranslation();
        sendResponse({ success: true });
        break;
      case 'showTranslationResult':
        console.log('Tidy: 显示翻译结果');
        // 处理右键菜单翻译结果
        this.showTranslationPopup(message.originalText, message.translation);
        sendResponse({ success: true });
        break;
      case 'showNotification':
        this.showNotification(message.message, message.type || 'info');
        sendResponse({ success: true });
        break;
      default:
        console.log('Tidy: 未知消息类型:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
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

    // 绑定悬浮按钮事件处理器
    this.boundFloatButtonMouseenter = () => {
      this.floatButton.style.transform = 'translateY(-50%) scale(1.1)';
      this.floatButton.style.boxShadow = '0 6px 25px rgba(79, 70, 229, 0.4)';
    };

    this.boundFloatButtonMouseleave = () => {
      this.floatButton.style.transform = 'translateY(-50%) scale(1)';
      this.floatButton.style.boxShadow = '0 4px 20px rgba(79, 70, 229, 0.3)';
    };

    this.boundFloatButtonClick = () => {
      this.toggleTranslation();
    };

    // 添加悬停效果
    this.floatButton.addEventListener('mouseenter', this.boundFloatButtonMouseenter);
    this.floatButton.addEventListener('mouseleave', this.boundFloatButtonMouseleave);

    // 点击事件
    this.floatButton.addEventListener('click', this.boundFloatButtonClick);

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
    // 绑定事件处理器
    this.boundKeydownHandler = (e) => {
      // Option/Alt + A: 切换翻译（Mac/Win 双平台）
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.toggleTranslation();
      }
      // Option/Alt + W: 翻译整个页面
      if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        this.translatePage();
      }
    };

    this.boundContextmenuHandler = (e) => {
      // 记录右键位置，用于可能的翻译操作
      this.lastContextMenuPosition = { x: e.clientX, y: e.clientY };
    };

    // 快捷键支持
    document.addEventListener('keydown', this.boundKeydownHandler);

    // 右键菜单支持（通过background script处理）
    document.addEventListener('contextmenu', this.boundContextmenuHandler);
  }

  // 设置选择翻译
  setupSelectionTranslation() {
    let selectionTimeout;

    this.boundMouseupHandler = () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        if (selection.toString().trim().length > 0) {
          this.showSelectionButton(selection);
        } else {
          this.hideSelectionButton();
        }
      }, 200);
    };

    this.boundMousedownHandler = () => {
      this.hideSelectionButton();
    };

    document.addEventListener('mouseup', this.boundMouseupHandler);
    document.addEventListener('mousedown', this.boundMousedownHandler);
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

  // 翻译页面 - 使用最新的分段并发翻译策略
  async translatePage(settings = null) {
    if (this.isTranslating) return;

    try {
      this.isTranslating = true;
      this.showProgress('正在分析页面内容...');

      const currentSettings = settings || this.settings;
      
      // 检查API密钥
      if (!currentSettings.apiKey) {
        this.hideProgress();
        this.showNotification('请先在插件设置中配置API密钥', 'warning');
        return;
      }
      
      // 使用智能内容提取策略
      const elements = this.getTranslatableElementsAdvanced();
      
      if (elements.length === 0) {
        this.hideProgress();
        this.showNotification('未找到可翻译的内容', 'warning');
        return;
      }

      console.log(`找到 ${elements.length} 个可翻译元素`);
      this.showProgress(`找到 ${elements.length} 个可翻译段落，开始翻译...`);

      // 使用并发池进行翻译
      await this.translateWithConcurrencyPool(elements, currentSettings);
      
    } catch (error) {
      console.error('翻译失败:', error);
      this.hideProgress();
      
      if (error.message.includes('扩展上下文已失效')) {
        this.showNotification('扩展上下文已失效，请刷新页面重试', 'error');
      } else {
        this.showNotification(`翻译失败: ${error.message}`, 'error');
      }
    } finally {
      this.isTranslating = false;
    }
  }

  // 智能内容提取策略 - 参考immersive-translate的最佳实践
  getTranslatableElementsAdvanced() {
    // 主要内容区域选择器（按优先级排序）
    const contentSelectors = [
      'article', 'main', '[role="main"]', '.content', '.post', '.article',
      '.entry', '.story', '.news', '.blog', '#content', '#main'
    ];
    
    // 尝试找到主要内容区域
    let contentRoot = document.body;
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        contentRoot = element;
        console.log('Tidy: 找到主要内容区域:', selector);
        break;
      }
    }
    
    // 可翻译元素选择器
    const translatableSelectors = [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th',
      'div:not([class*="nav"]):not([class*="menu"]):not([class*="header"]):not([class*="footer"])',
      'span:not([class*="icon"]):not([class*="btn"])', 'a', 'button:not([class*="close"])',
      'label', 'figcaption', 'blockquote', 'cite', 'summary', 'details > p'
    ];
    
    // 排除选择器
    const excludeSelectors = [
      'script', 'style', 'noscript', 'code', 'pre', 'svg', 'canvas',
      '.translate-exclude', '[data-translate="no"]', '[translate="no"]',
      '.ad', '.ads', '.advertisement', '.sponsor', '.promo',
      'nav', 'header', 'footer', '.navbar', '.menu', '.sidebar',
      '.comment-form', '.search', '.pagination', '.breadcrumb',
      '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
      '[aria-hidden="true"]', '.sr-only', '.visually-hidden'
    ];
    
    const elements = contentRoot.querySelectorAll(translatableSelectors.join(', '));
    
    return Array.from(elements).filter(el => {
      // 排除不可见元素
      if (el.offsetParent === null || 
          getComputedStyle(el).display === 'none' ||
          getComputedStyle(el).visibility === 'hidden') {
        return false;
      }
      
      // 排除特定选择器匹配的元素
      if (excludeSelectors.some(selector => el.matches(selector) || el.closest(selector))) {
        return false;
      }
      
      // 排除已翻译的元素
      if (el.hasAttribute('data-ai-translated')) return false;
      
      // 排除只包含其他可翻译元素的容器
      const hasTranslatableChildren = el.querySelector(translatableSelectors.join(', '));
      if (hasTranslatableChildren && el.children.length > 0) {
        const textContent = Array.from(el.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim())
          .join('');
        if (textContent.length < 10) return false;
      }
      
      const text = el.textContent.trim();
      
      // 文本长度检查
      if (text.length < 3 || text.length > 5000) return false;
      
      // 内容质量检查
      if (!/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\u1100-\u11ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff\u1f00-\u1fff\u2000-\u206f\u2e00-\u2e7f\ua720-\ua7ff\uab00-\uabbf\ufb00-\ufb4f\u0100-\u017f\u1e00-\u1eff]|[a-zA-Z]/.test(text)) {
        return false;
      }
      
      // 排除纯数字、日期、URL等
      if (/^[\d\s\-\/\:\.]+$/.test(text) || 
          /^https?:\/\//.test(text) ||
          /^[+\-\(\)\s\d]+$/.test(text)) {
        return false;
      }
      
      return true;
    });
  }

  // 并发翻译池 - 实现真正的并发翻译
  async translateWithConcurrencyPool(elements, settings) {
    const maxConcurrency = this.concurrencyLimit;
    let index = 0;
    let successCount = 0;
    let failureCount = 0;
    
    // 创建并发池
    const pool = [];
    
    const processNext = async () => {
      while (index < elements.length && this.isTranslating) {
        // 检查扩展上下文
        if (!chrome.runtime?.id) {
          console.error('Tidy: 翻译过程中检测到扩展上下文失效');
          this.handleExtensionContextInvalidated();
          throw new Error('扩展上下文已失效');
        }
        
        const element = elements[index++];
        const currentIndex = index;
        
        try {
          const result = await this.translateSingleElement(element, settings);
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
          
          // 更新进度
          const progress = Math.round((currentIndex / elements.length) * 100);
          this.updateProgress(`翻译进度: ${progress}% (${successCount}成功, ${failureCount}失败)`);
          
        } catch (error) {
          failureCount++;
          console.error('翻译元素失败:', error);
          
          // 如果是上下文失效，停止翻译
          if (error.message.includes('扩展上下文已失效')) {
            throw error;
          }
        }
        
        // 添加小延迟避免API限流
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };
    
    // 启动并发工作进程
    for (let i = 0; i < maxConcurrency; i++) {
      pool.push(processNext());
    }
    
    try {
      await Promise.all(pool);
      
      this.hideProgress();
      
      // 显示最终结果
      if (successCount > 0) {
        if (failureCount > 0) {
          this.showNotification(`页面翻译完成：${successCount}个成功，${failureCount}个失败`, 'warning');
        } else {
          this.showNotification(`页面翻译完成：共翻译${successCount}个段落`, 'success');
        }
      } else {
        this.showNotification('翻译失败，请检查网络连接和API配置', 'error');
      }
      
    } catch (error) {
      this.hideProgress();
      throw error;
    }
  }

  // 翻译单个元素
  async translateSingleElement(element, settings) {
    const originalText = element.textContent.trim();
    if (!originalText) {
      return { success: false, error: '文本为空' };
    }

    try {
      const translation = await this.requestTranslation(originalText, settings);
      
      if (translation) {
        this.applyTranslation(element, originalText, translation, settings.translateMode);
        return { success: true, element, originalText, translation };
      } else {
        return { success: false, element, originalText, error: '翻译返回空结果' };
      }
    } catch (error) {
      return { success: false, element, originalText, error: error.message };
    }
  }

  // 翻译选中文本
  async translateSelection(text) {
    if (!text.trim()) return;
    try {
      this.showProgress('正在翻译选中内容...');
      const translation = await this.requestTranslation(text, this.settings);
      if (translation) {
        // 根据设置的显示模式显示翻译结果
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          this.applySelectionTranslation(range, text, translation, this.settings.translateMode);
        }
      }
    } catch (error) {
      console.error('翻译选中文本失败:', error);
      this.showNotification('翻译失败', 'error');
    } finally {
      this.hideProgress();
    }
  }

  // 应用选择翻译
  applySelectionTranslation(range, originalText, translation, mode) {
    const container = document.createElement('span');
    container.className = 'ai-translation-selection';
    
    switch (mode) {
      case 'immersive-bilingual':
        container.innerHTML = `
          <span class="original-text">${originalText}</span>
          <span class="translated-text">${translation}</span>
        `;
        container.style.cssText = `
          display: inline-block;
          background: linear-gradient(120deg, rgba(79, 70, 229, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%);
          padding: 4px 6px;
          border-radius: 4px;
          border-left: 3px solid #4f46e5;
          margin: 2px 0;
          line-height: 1.6;
        `;
        break;
        
      case 'replace':
        container.textContent = translation;
        container.title = `原文: ${originalText}`;
        container.style.cssText = `
          background: rgba(79, 70, 229, 0.1);
          padding: 2px 4px;
          border-radius: 3px;
          border-bottom: 2px dotted #4f46e5;
          cursor: help;
        `;
        break;
        
      default:
        container.innerHTML = `
          <div style="color: #6b7280; font-size: 0.9em; margin-bottom: 2px;">${originalText}</div>
          <div style="color: #1f2937; font-weight: 500;">${translation}</div>
        `;
        container.style.cssText = `
          display: inline-block;
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(79, 70, 229, 0.2);
          border-radius: 6px;
          padding: 8px 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          max-width: 300px;
          line-height: 1.5;
        `;
    }
    
    range.deleteContents();
    range.insertNode(container);
  }

  // 请求翻译
  async requestTranslation(text, settings) {
    // 检查扩展上下文是否有效
    if (!chrome.runtime?.id) {
      console.error('Tidy: 扩展上下文无效，无法发送翻译请求');
      throw new Error('扩展上下文已失效，请刷新页面');
    }

    // 根据模型调整超时时间
    const getTimeoutForModel = (aiModel) => {
      switch (aiModel) {
        case 'qwen3':
          return 60000; // Qwen3 给60秒超时时间
        case 'claude-3':
          return 45000; // Claude给45秒
        case 'gemini-pro':
          return 45000; // Gemini给45秒
        default:
          return 30000; // 其他模型30秒
      }
    };

    const timeoutMs = getTimeoutForModel(settings.aiModel);
    
    return new Promise((resolve, reject) => {
      // 重试机制
      let retryCount = 0;
      const maxRetries = 2;
      
      const attemptTranslation = () => {
        // 每次重试前都检查上下文
        if (!chrome.runtime?.id) {
          console.error('Tidy: 扩展上下文无效，无法发送翻译请求');
          this.handleExtensionContextInvalidated();
          reject(new Error('扩展上下文已失效，请刷新页面'));
          return;
        }

        // 设置超时
        const timeout = setTimeout(() => {
          console.warn(`Tidy: 翻译请求超时 (${timeoutMs}ms)，模型: ${settings.aiModel}`);
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Tidy: 尝试重试翻译 (${retryCount}/${maxRetries})`);
            setTimeout(attemptTranslation, 1000); // 1秒后重试
          } else {
            reject(new Error(`翻译请求超时，已重试${maxRetries}次，请检查网络连接或稍后重试`));
          }
        }, timeoutMs);

        try {
          chrome.runtime.sendMessage({
            action: 'translate',
            text: text,
            settings: settings
          }, (response) => {
            clearTimeout(timeout);
            
            // 检查运行时错误
            if (chrome.runtime.lastError) {
              console.error('Tidy: Runtime error:', chrome.runtime.lastError);
              
              // 检查是否是上下文失效错误
              if (chrome.runtime.lastError.message.includes('Extension context invalidated') ||
                  chrome.runtime.lastError.message.includes('receiving end does not exist')) {
                console.error('Tidy: 检测到扩展上下文失效');
                this.handleExtensionContextInvalidated();
                reject(new Error('扩展上下文已失效，请刷新页面重试'));
              } else if (retryCount < maxRetries) {
                // 其他错误尝试重试
                retryCount++;
                console.log(`Tidy: 遇到错误，尝试重试 (${retryCount}/${maxRetries}): ${chrome.runtime.lastError.message}`);
                setTimeout(attemptTranslation, 2000); // 2秒后重试
              } else {
                reject(new Error(chrome.runtime.lastError.message));
              }
              return;
            }
            
            // 检查响应
            if (response && response.success) {
              if (response.translation && response.translation.trim()) {
                resolve(response.translation);
              } else {
                console.warn('Tidy: 翻译返回空结果');
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`Tidy: 翻译结果为空，尝试重试 (${retryCount}/${maxRetries})`);
                  setTimeout(attemptTranslation, 1000);
                } else {
                  reject(new Error('翻译返回空结果'));
                }
              }
            } else {
              const errorMessage = response?.error || '翻译请求失败';
              console.error('Tidy: Translation error:', errorMessage);
              
              // 如果是API相关错误且还有重试次数，则重试
              if (retryCount < maxRetries && (
                errorMessage.includes('timeout') ||
                errorMessage.includes('network') ||
                errorMessage.includes('连接') ||
                errorMessage.includes('超时')
              )) {
                retryCount++;
                console.log(`Tidy: 网络相关错误，尝试重试 (${retryCount}/${maxRetries}): ${errorMessage}`);
                setTimeout(attemptTranslation, 3000); // 3秒后重试
              } else {
                reject(new Error(errorMessage));
              }
            }
          });
        } catch (error) {
          clearTimeout(timeout);
          console.error('Tidy: 发送消息时出错:', error);
          
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Tidy: 发送消息异常，尝试重试 (${retryCount}/${maxRetries}): ${error.message}`);
            setTimeout(attemptTranslation, 2000);
          } else {
            reject(new Error('扩展通信失败，请刷新页面重试'));
          }
        }
      };

      // 开始首次尝试
      attemptTranslation();
    });
  }

  // 应用翻译 - 支持多种显示模式
  applyTranslation(element, originalText, translation, mode) {
    // 标记为已翻译
    element.setAttribute('data-ai-translated', 'true');
    element.setAttribute('data-original-text', originalText);

    switch (mode) {
      case 'immersive-bilingual':
        this.applyImmersiveBilingual(element, originalText, translation);
        break;
      case 'replace':
        this.applyReplace(element, originalText, translation);
        break;
      case 'side-by-side':
        this.applySideBySide(element, originalText, translation);
        break;
      default:
        this.applyImmersiveBilingual(element, originalText, translation);
    }

    // 记录翻译
    this.translatedElements.set(element, { originalText, translation, mode });
  }

  // 沉浸式双语显示 - 参考immersive-translate的设计
  applyImmersiveBilingual(element, originalText, translation) {
    const container = document.createElement('div');
    container.className = 'ai-translation-immersive';
    
    container.innerHTML = `
      <div class="original-text">${originalText}</div>
      <div class="translated-text">${translation}</div>
    `;
    
    // 不应用任何样式，让译文继承原文的字体样式
    
    element.innerHTML = '';
    element.appendChild(container);
  }

  // 替换显示模式
  applyReplace(element, originalText, translation) {
    element.innerHTML = translation;
    element.title = `原文: ${originalText}`;
    element.style.cssText = `
      background: linear-gradient(120deg, rgba(79, 70, 229, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%);
      padding: 3px 6px;
      border-radius: 4px;
      border-bottom: 2px dotted #4f46e5;
      cursor: help;
      transition: all 0.2s ease;
    `;
  }

  // 并排显示模式
  applySideBySide(element, originalText, translation) {
    const container = document.createElement('div');
    container.className = 'ai-translation-side-by-side';
    
    container.innerHTML = `
      <div class="original-side">${originalText}</div>
      <div class="translated-side">${translation}</div>
    `;
    
    container.style.cssText = `
      display: flex;
      gap: 12px;
      border: 1px solid rgba(79, 70, 229, 0.2);
      border-radius: 8px;
      overflow: hidden;
      margin: 4px 0;
    `;
    
    const originalSide = container.querySelector('.original-side');
    originalSide.style.cssText = `
      flex: 1;
      padding: 10px;
      background: rgba(79, 70, 229, 0.05);
      color: #4b5563;
      font-size: 0.95em;
    `;
    
    const translatedSide = container.querySelector('.translated-side');
    translatedSide.style.cssText = `
      flex: 1;
      padding: 10px;
      background: rgba(16, 185, 129, 0.05);
      color: #1f2937;
      font-weight: 500;
    `;
    
    element.innerHTML = '';
    element.appendChild(container);
  }

  // 清除翻译
  clearTranslation() {
    // 恢复所有翻译的元素
    this.translatedElements.forEach((data, element) => {
      element.textContent = data.originalText;
      element.removeAttribute('data-ai-translated');
      element.removeAttribute('data-original-text');
      element.removeAttribute('style');
      element.removeAttribute('title');
    });

    this.translatedElements.clear();

    // 清除选择按钮
    this.hideSelectionButton();

    // 清除翻译弹窗
    this.hideTranslationPopup();

    this.showNotification('翻译已清除', 'info');
  }

  // 显示翻译弹窗（现在改为在选中内容下方插入浮层）
  showTranslationPopup(originalText, translation) {
    // 先移除旧的
    this.hideTranslationPopup();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    // 创建浮层
    const popup = document.createElement('div');
    popup.id = 'ai-translator-popup-inline';
    popup.innerHTML = `<div style="font-size:15px;line-height:1.7;white-space:pre-line;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.12);max-width:420px;min-width:200px;">
      <div style='color:#6b7280;margin-bottom:6px;font-size:0.9em;'>${originalText}</div>
      <div style='color:#1f2937;font-weight:500;'>${translation}</div>
    </div>`;
    popup.style.position = 'fixed';
    popup.style.left = (rect.left + window.scrollX) + 'px';
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    popup.style.zIndex = 10010;
    popup.style.pointerEvents = 'auto';
    popup.style.transition = 'opacity 0.3s ease';
    popup.style.opacity = '1';
    // 点击浮层外自动消失
    setTimeout(() => {
      const handler = (e) => {
        if (!popup.contains(e.target)) {
          this.hideTranslationPopup();
          document.removeEventListener('mousedown', handler);
        }
      };
      document.addEventListener('mousedown', handler);
    }, 0);
    document.body.appendChild(popup);
  }

  // 隐藏翻译弹窗（支持新浮层）
  hideTranslationPopup() {
    const popup = document.getElementById('ai-translator-popup-inline') || document.getElementById('ai-translator-popup');
    if (popup) popup.remove();
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
      min-width: 280px;
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
    
    // 如果是上下文失效错误，提供更详细的提示
    if (message.includes('扩展上下文已失效')) {
      notification.innerHTML = `
        <div style="margin-bottom: 8px;">${message}</div>
        <div style="font-size: 12px; opacity: 0.9; line-height: 1.4;">
          解决方法：<br>
          1. 刷新当前页面<br>
          2. 或重新启用扩展
        </div>
      `;
    } else {
      notification.textContent = message;
    }
    
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
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.4;
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

    // 对于上下文失效错误，延长显示时间
    const displayTime = message.includes('扩展上下文已失效') ? 8000 : 3000;
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, displayTime);
  }
}

// 初始化翻译控制器
const translationController = new TranslationController();

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  if (translationController) {
    translationController.cleanup();
  }
});