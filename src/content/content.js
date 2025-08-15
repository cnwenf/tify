// content.js - 内容脚本：处理网页翻译

// 翻译请求池管理类
class TranslationPool {
  constructor(maxConcurrency = 5, requestDelay = 100) {
    this.maxConcurrency = maxConcurrency;
    this.requestDelay = requestDelay;
    this.activeRequests = 0;
    this.queue = [];
    this.completed = 0;
    this.failed = 0;
    this.startTime = null;
  }

  // 添加翻译任务到队列
  async addTask(taskFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        taskFn,
        resolve,
        reject,
        timestamp: Date.now()
      });
      this.processQueue();
    });
  }

  // 处理队列中的任务
  async processQueue() {
    if (this.activeRequests >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.activeRequests++;

    // 记录开始时间
    if (!this.startTime && this.activeRequests === 1) {
      this.startTime = Date.now();
    }

    try {
      // 添加请求延迟，避免API限流
      const timeSinceLastRequest = Date.now() - task.timestamp;
      if (timeSinceLastRequest < this.requestDelay) {
        await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
      }

      const result = await task.taskFn();
      task.resolve(result);
      this.completed++;
    } catch (error) {
      task.reject(error);
      this.failed++;
    } finally {
      this.activeRequests--;
      // 继续处理队列中的下一个任务
      setTimeout(() => this.processQueue(), 10);
    }
  }

  // 获取统计信息
  getStats() {
    const elapsed = this.startTime ? Date.now() - this.startTime : 0;
    const totalProcessed = this.completed + this.failed;
    const rate = elapsed > 0 ? (totalProcessed / elapsed * 1000).toFixed(2) : 0;
    
    return {
      active: this.activeRequests,
      queued: this.queue.length,
      completed: this.completed,
      failed: this.failed,
      total: totalProcessed,
      rate: `${rate} req/s`,
      elapsed: elapsed
    };
  }

  // 重置统计
  reset() {
    this.completed = 0;
    this.failed = 0;
    this.startTime = null;
  }

  // 清空队列
  clear() {
    // 拒绝所有等待的任务
    this.queue.forEach(task => {
      task.reject(new Error('Translation cancelled'));
    });
    this.queue = [];
    this.reset();
  }

  // 设置并发数
  setConcurrency(maxConcurrency) {
    this.maxConcurrency = Math.max(1, Math.min(maxConcurrency, 10));
    // 如果降低并发数，继续处理队列
    this.processQueue();
  }

  // 设置请求延迟
  setRequestDelay(delay) {
    this.requestDelay = Math.max(0, delay);
  }
}

class TranslationController {
  constructor() {
    this.settings = {};
    this.translatedElements = new Map();
    this.floatButton = null;
    this.isTranslating = false;
    this.selectionMode = false;
    this.extensionCheckInterval = null;
    
    // 初始化翻译请求池
    this.translationPool = new TranslationPool(5, 100);
    
    // 性能优化：翻译缓存
    this.translationCache = new Map();
    this.cacheMaxSize = 1000; // 最大缓存条目数
    this.cacheHitCount = 0;
    this.cacheMissCount = 0;
    
    // 性能优化：DOM操作优化
    this.domUpdateQueue = [];
    this.domUpdateBatchSize = 10;
    this.domUpdateTimer = null;
    
    // 性能优化：内存管理
    this.memoryCleanupInterval = null;
    this.setupMemoryManagement();
    
    // 延迟初始化，确保DOM已加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
      });
    } else {
      this.init();
    }
  }

  // 设置内存管理
  setupMemoryManagement() {
    // 每5分钟清理一次内存
    this.memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 5 * 60 * 1000);
    
    // 监听页面可见性变化，在页面隐藏时清理内存
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performMemoryCleanup();
      }
    });
  }

  // 执行内存清理
  performMemoryCleanup() {
    const before = this.translationCache.size;
    
    // 清理过期的缓存条目
    this.cleanupTranslationCache();
    
    // 清理已删除的DOM元素引用
    this.cleanupTranslatedElements();
    
    // 清理DOM更新队列
    this.domUpdateQueue = [];
    
    const after = this.translationCache.size;
    
    if (before !== after) {
      console.log(`Tidy: 内存清理完成，缓存从 ${before} 条减少到 ${after} 条`);
    }
    
    // 强制垃圾回收（如果可用）
    if (window.gc) {
      window.gc();
    }
  }

  // 清理翻译缓存
  cleanupTranslationCache() {
    // 如果缓存超过最大大小，删除最老的条目
    if (this.translationCache.size > this.cacheMaxSize) {
      const entriesToDelete = this.translationCache.size - this.cacheMaxSize;
      const keys = Array.from(this.translationCache.keys());
      
      for (let i = 0; i < entriesToDelete; i++) {
        this.translationCache.delete(keys[i]);
      }
    }
  }

  // 清理已删除的DOM元素引用
  cleanupTranslatedElements() {
    const elementsToDelete = [];
    
    this.translatedElements.forEach((data, element) => {
      // 检查元素是否还在DOM中
      if (!document.contains(element)) {
        elementsToDelete.push(element);
      }
    });
    
    elementsToDelete.forEach(element => {
      this.translatedElements.delete(element);
    });
    
    if (elementsToDelete.length > 0) {
      console.log(`Tidy: 清理了 ${elementsToDelete.length} 个已删除的DOM元素引用`);
    }
  }

  // 生成缓存键
  generateCacheKey(text, settings) {
    // 创建基于文本和关键设置的缓存键
    const keyData = {
      text: text.trim(),
      aiModel: settings.aiModel,
      targetLanguage: settings.targetLanguage,
      sourceLanguage: settings.sourceLanguage
    };
    
    // 简单的哈希函数
    const str = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString(36);
  }

  // 缓存翻译结果
  cacheTranslation(text, settings, translation) {
    const key = this.generateCacheKey(text, settings);
    this.translationCache.set(key, {
      translation: translation,
      timestamp: Date.now(),
      accessCount: 1
    });
    
    // 定期清理缓存
    if (this.translationCache.size > this.cacheMaxSize) {
      this.cleanupTranslationCache();
    }
  }

  // 获取缓存的翻译
  getCachedTranslation(text, settings) {
    const key = this.generateCacheKey(text, settings);
    const cached = this.translationCache.get(key);
    
    if (cached) {
      // 更新访问统计
      cached.accessCount++;
      cached.lastAccess = Date.now();
      this.cacheHitCount++;
      
      return cached.translation;
    } else {
      this.cacheMissCount++;
      return null;
    }
  }

  // 优化的翻译请求（带缓存）
  async requestTranslationOptimized(text, settings) {
    // 首先检查缓存
    const cachedTranslation = this.getCachedTranslation(text, settings);
    if (cachedTranslation) {
      console.log('Tidy: 使用缓存的翻译结果');
      return cachedTranslation;
    }
    
    // 缓存未命中，执行实际翻译
    try {
      const translation = await this.requestTranslationWithAdvancedRetry(text, settings);
      
      // 缓存结果
      if (translation && translation.trim()) {
        this.cacheTranslation(text, settings, translation);
      }
      
      return translation;
    } catch (error) {
      // 记录错误但不缓存失败结果
      console.error('Tidy: 翻译失败，不缓存结果:', error.message);
      throw error;
    }
  }

  // 批量DOM更新优化
  queueDOMUpdate(updateFunction) {
    this.domUpdateQueue.push(updateFunction);
    
    // 如果队列达到批处理大小或者没有待处理的更新，立即处理
    if (this.domUpdateQueue.length >= this.domUpdateBatchSize || !this.domUpdateTimer) {
      this.processDOMUpdateQueue();
    }
  }

  // 处理DOM更新队列
  processDOMUpdateQueue() {
    if (this.domUpdateTimer) {
      clearTimeout(this.domUpdateTimer);
      this.domUpdateTimer = null;
    }
    
    if (this.domUpdateQueue.length === 0) {
      return;
    }
    
    // 使用requestAnimationFrame确保在浏览器重绘前更新
    requestAnimationFrame(() => {
      const updates = this.domUpdateQueue.splice(0, this.domUpdateBatchSize);
      
      // 批量执行DOM更新
      updates.forEach(updateFunction => {
        try {
          updateFunction();
        } catch (error) {
          console.warn('Tidy: DOM更新失败:', error);
        }
      });
      
      // 如果还有更多更新，继续处理
      if (this.domUpdateQueue.length > 0) {
        this.domUpdateTimer = setTimeout(() => {
          this.processDOMUpdateQueue();
        }, 16); // ~60fps
      }
    });
  }

  // 优化的翻译应用（使用DOM更新队列）
  async applyTranslationOptimized(element, originalText, translation, mode) {
    return new Promise((resolve) => {
      this.queueDOMUpdate(() => {
        this.applyTranslation(element, originalText, translation, mode);
        resolve();
      });
    });
  }

  // 智能节流翻译请求
  createThrottledTranslation() {
    const requestMap = new Map();
    
    return async (text, settings) => {
      const key = this.generateCacheKey(text, settings);
      
      // 如果相同的请求正在进行中，等待其完成
      if (requestMap.has(key)) {
        console.log('Tidy: 等待相同翻译请求完成...');
        return await requestMap.get(key);
      }
      
      // 创建新的翻译请求
      const translationPromise = this.requestTranslationOptimized(text, settings);
      requestMap.set(key, translationPromise);
      
      try {
        const result = await translationPromise;
        return result;
      } finally {
        // 请求完成后清理映射
        requestMap.delete(key);
      }
    };
  }

  // 获取性能统计信息
  getPerformanceStats() {
    const totalRequests = this.cacheHitCount + this.cacheMissCount;
    const hitRate = totalRequests > 0 ? (this.cacheHitCount / totalRequests * 100).toFixed(2) : 0;
    
    return {
      cacheSize: this.translationCache.size,
      cacheHitCount: this.cacheHitCount,
      cacheMissCount: this.cacheMissCount,
      hitRate: `${hitRate}%`,
      translatedElements: this.translatedElements.size,
      domUpdateQueueSize: this.domUpdateQueue.length,
      poolStats: this.translationPool.getStats()
    };
  }

  // 预加载常用翻译
  async preloadCommonTranslations(texts, settings) {
    console.log('Tidy: 开始预加载常用翻译...');
    
    const preloadPromises = texts.map(async (text) => {
      try {
        await this.requestTranslationOptimized(text, settings);
      } catch (error) {
        console.warn('预加载翻译失败:', text.substring(0, 30), error.message);
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log('Tidy: 预加载完成');
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
    
    // 清理翻译请求池
    if (this.translationPool) {
      this.translationPool.clear();
    }
    
    // 清理缓存和性能优化组件
    if (this.translationCache) {
      this.translationCache.clear();
    }
    
    if (this.domUpdateTimer) {
      clearTimeout(this.domUpdateTimer);
      this.domUpdateTimer = null;
    }
    
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
    
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
          translateMode: 'bilingual'
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
        translateMode: result.translateMode || 'bilingual',
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
        translateMode: 'bilingual'
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

  // 翻译页面
  async translatePage(settings = null) {
    if (this.isTranslating) return;

    try {
      this.isTranslating = true;
      this.showProgress('正在分析页面内容...');

      // 初始化视觉效果
      this.createTranslationVisualEffects();

      const currentSettings = settings || this.settings;
      
      // 检查API密钥
      if (!currentSettings.apiKey) {
        this.hideProgress();
        this.showNotification('请先在插件设置中配置API密钥', 'warning');
        return;
      }
      
      // 获取需要翻译的文本元素
      const elements = this.getTranslatableElements();
      
      if (elements.length === 0) {
        this.hideProgress();
        this.showNotification('未找到可翻译的内容', 'warning');
        return;
      }

      console.log(`找到 ${elements.length} 个可翻译元素`);

      // 应用内容分段优化
      let translationSegments;
      if (currentSettings.enableSegmentation !== false) {
        this.updateProgress('正在优化内容分段...');
        translationSegments = this.optimizeContentSegmentation(elements);
      } else {
        // 如果禁用分段优化，直接使用原始元素
        translationSegments = elements.map(element => ({
          type: 'single',
          elements: [element],
          text: element.textContent.trim()
        }));
      }

      // 使用翻译请求池进行高效并发管理
      const maxConcurrency = Math.min(currentSettings.maxConcurrency || 5, 8);
      this.translationPool.setConcurrency(maxConcurrency);
      this.translationPool.setRequestDelay(currentSettings.requestDelay || 100);
      this.translationPool.reset(); // 重置统计信息
      
      let successCount = 0;
      let failureCount = 0;
      let processedCount = 0;
      
      // 创建高级进度指示器
      const segmentProgress = this.createSegmentProgressIndicator(translationSegments);
      
      // 创建翻译进度追踪
      const updateOverallProgress = () => {
        const totalProgress = Math.round((processedCount / translationSegments.length) * 100);
        const poolStats = this.translationPool.getStats();
        this.updateProgress(`翻译进度: ${totalProgress}% (${successCount}成功, ${failureCount}失败) | ${poolStats.rate} | 队列:${poolStats.queued}`);
        
        // 更新高级进度指示器
        this.updateSegmentProgress(segmentProgress, processedCount, translationSegments.length, successCount, failureCount, poolStats);
      };

      // 创建翻译任务
      const createTranslationTask = (segment, index) => {
        return async () => {
          // 检查扩展上下文
          if (!chrome.runtime?.id) {
            console.error('Tidy: 翻译过程中检测到扩展上下文失效');
            this.handleExtensionContextInvalidated();
            throw new Error('扩展上下文已失效');
          }

          // 检查翻译是否被取消
          if (!this.isTranslating) {
            console.log('Tidy: 翻译被用户取消');
            throw new Error('Translation cancelled');
          }

          const originalText = segment.text;
          if (!originalText) {
            return { success: true, skipped: true };
          }

          console.log(`翻译第 ${index + 1}/${translationSegments.length} 个片段 (${segment.type}):`, originalText.substring(0, 50) + '...');
          
          const translation = await this.requestTranslationOptimized(originalText, currentSettings);
          
          if (translation) {
            // 对片段中的所有元素应用翻译
            await this.applySegmentTranslation(segment, originalText, translation, currentSettings.translateMode);
            console.log(`第 ${index + 1} 个片段翻译完成:`, translation.substring(0, 50) + '...');
            return { success: true, segment, originalText, translation };
          } else {
            console.warn(`第 ${index + 1} 个片段翻译返回空结果`);
            throw new Error('翻译返回空结果');
          }
        };
      };

      // 将所有翻译任务添加到池中
      const translationPromises = translationSegments.map((segment, index) => {
        return this.translationPool.addTask(createTranslationTask(segment, index))
          .then(result => {
            if (result.success && !result.skipped) {
              successCount++;
            }
            processedCount++;
            updateOverallProgress();
            return result;
          })
          .catch(error => {
            failureCount++;
            processedCount++;
            updateOverallProgress();
            console.error(`第 ${index + 1} 个片段翻译失败:`, error.message);
            
            // 如果是上下文失效错误，需要特殊处理
            if (error.message.includes('扩展上下文已失效')) {
              throw error;
            }
            
            return { success: false, segment, error: error.message };
          });
      });

      try {
        // 等待所有翻译完成
        console.log(`开始并发翻译 ${translationSegments.length} 个片段，最大并发数: ${maxConcurrency}`);
        const results = await Promise.allSettled(translationPromises);
        
        // 检查是否有上下文失效的错误
        const contextErrors = results.filter(r => 
          r.status === 'rejected' && 
          r.reason?.message?.includes('扩展上下文已失效')
        );
        
        if (contextErrors.length > 0) {
          console.error('Tidy: 检测到扩展上下文失效，停止翻译');
          throw new Error('扩展上下文已失效');
        }
        
        // 计算最终统计
        const finalStats = this.translationPool.getStats();
        console.log('Tidy: 翻译完成统计:', finalStats);
        
      } catch (error) {
        console.error('翻译过程出错:', error);
        
        // 如果是上下文失效，停止所有翻译
        if (error.message.includes('扩展上下文已失效')) {
          this.translationPool.clear();
          throw error;
        }
      }

      this.hideProgress();
      this.hideSegmentProgress();
      
      // 显示最终结果
      if (successCount > 0) {
        if (failureCount > 0) {
          this.showNotification(`页面翻译完成：${successCount}个成功，${failureCount}个失败`, 'warning');
        } else {
          this.showNotification(`页面翻译完成：共翻译${successCount}个片段`, 'success');
        }
      } else {
        this.showNotification('翻译失败，请检查网络连接和API配置', 'error');
      }
      
    } catch (error) {
      console.error('翻译失败:', error);
      this.hideProgress();
      this.hideSegmentProgress();
      
      if (error.message.includes('扩展上下文已失效')) {
        this.showNotification('扩展上下文已失效，请刷新页面重试', 'error');
      } else {
        this.showNotification(`翻译失败: ${error.message}`, 'error');
      }
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
        // 直接在页面中插入原文+译文
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const span = document.createElement('span');
          span.className = 'ai-translation-bilingual-inline';
          span.style = 'background:rgba(255,255,0,0.15);white-space:pre-line;line-height:1.7;';
          span.textContent = `${text}\n${translation}`;
          range.deleteContents();
          range.insertNode(span);
        }
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
    // 更智能的内容区域检测，参考 immersive-translate 的策略
    const contentSelectors = [
      // 主要内容区域
      'main', 'article', '[role="main"]', '.content', '.main-content', 
      '.post-content', '.entry-content', '.article-content', '.news-content',
      
      // 常见的文本元素
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 
      'blockquote', 'figcaption', 'caption', '.text', '.description',
      
      // 特殊网站适配
      '[data-testid="tweetText"]', // Twitter
      '.md', '.markdown', // GitHub, GitLab
      '.answer-content', '.question-content', // Stack Overflow
      '.message-content', // Discord
    ];

    const excludeSelectors = [
      // 导航和UI元素
      'nav', 'header', 'footer', 'aside', '.nav', '.navbar', '.menu',
      '.sidebar', '.breadcrumb', '.pagination', '.toolbar',
      
      // 广告和推广内容
      '.ad', '.ads', '.advertisement', '.promo', '.sponsored',
      '[data-ad]', '[class*="ad-"]', '[id*="ad-"]',
      
      // 代码和脚本
      'script', 'style', 'noscript', 'code', 'pre', 'kbd', 'samp',
      '.code', '.highlight', '.codehilite',
      
      // 表单和控制元素
      'button', 'input', 'select', 'textarea', 'label',
      '.btn', '.button', '.form-control',
      
      // 元数据和隐藏内容
      '.meta', '.metadata', '.date', '.time', '.author', '.tags',
      '.hidden', '.sr-only', '[aria-hidden="true"]', '[style*="display:none"]',
      
      // 评论和社交
      '.comment-meta', '.social-share', '.share-buttons'
    ];

    // 首先尝试找到主要内容容器
    const mainContentContainers = document.querySelectorAll('main, article, [role="main"], .content, .main-content, .post-content, .entry-content');
    let searchRoot = document.body;
    
    if (mainContentContainers.length > 0) {
      // 如果找到主内容容器，优先在其中搜索
      searchRoot = mainContentContainers[0];
      console.log('Tidy: 找到主内容容器:', searchRoot.tagName + (searchRoot.className ? '.' + searchRoot.className : ''));
    }

    // 获取所有候选元素
    const candidateElements = [];
    
    contentSelectors.forEach(selector => {
      try {
        const elements = searchRoot.querySelectorAll(selector);
        candidateElements.push(...Array.from(elements));
      } catch (e) {
        console.warn('Tidy: 选择器错误:', selector, e);
      }
    });

    // 去重并过滤
    const uniqueElements = [...new Set(candidateElements)];
    
    return uniqueElements.filter(el => {
      try {
        // 基本可见性检查
        if (!el || el.offsetParent === null || el.offsetWidth === 0 || el.offsetHeight === 0) {
          return false;
        }

        // 检查是否在排除列表中
        for (const excludeSelector of excludeSelectors) {
          if (el.matches(excludeSelector) || el.closest(excludeSelector)) {
            return false;
          }
        }

        // 检查是否已翻译
        if (el.hasAttribute('data-ai-translated')) {
          return false;
        }

        // 文本内容检查
        const text = el.textContent.trim();
        if (text.length < 3) {
          return false;
        }

        // 检查是否包含有意义的文本（字母、数字或各种语言字符）
        if (!/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\u1100-\u11ff\uac00-\ud7af\u0400-\u04ff\u0370-\u03ff\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff\u1f00-\u1fff\u2000-\u206f\u2e00-\u2e7f\ua720-\ua7ff\uab00-\uabbf\ufb00-\ufb4f\u0100-\u017f\u1e00-\u1eff]|[a-zA-Z0-9]/.test(text)) {
          return false;
        }

        // 避免翻译过短或纯符号的内容
        if (text.length < 10 && /^[\s\n\r\t.,!?;:"'""''()[\]{}<>|\\\/+=\-_*&^%$#@~`]+$/.test(text)) {
          return false;
        }

        // 检查是否为链接文本（短链接通常不需要翻译）
        if (el.tagName === 'A' && text.length < 20 && /^(https?:\/\/|www\.|[\w\.-]+\.(com|org|net|edu|gov|mil|int|co|io|me|ly|be|to))/.test(text)) {
          return false;
        }

        // 避免翻译嵌套元素（选择最具体的元素）
        const hasTranslatableChild = el.querySelector('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption');
        if (hasTranslatableChild && el.tagName === 'DIV') {
          // 如果是div且包含其他可翻译元素，跳过这个div
          return false;
        }

        // 检查父元素是否已经在候选列表中（避免重复翻译）
        let parent = el.parentElement;
        while (parent && parent !== searchRoot) {
          if (uniqueElements.includes(parent) && parent.textContent.trim() === text) {
            return false; // 父元素已包含且内容相同
          }
          parent = parent.parentElement;
        }

        return true;
      } catch (error) {
        console.warn('Tidy: 元素过滤出错:', error);
        return false;
      }
    }).sort((a, b) => {
      // 按DOM顺序排序，确保翻译顺序符合阅读习惯
      if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }
      return 1;
    });
  }

  // 批量翻译
  async translateBatch(elements, settings) {
    const results = [];
    
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      try {
        // 每个元素翻译前都检查上下文
        if (!chrome.runtime?.id) {
          console.error('Tidy: 批量翻译过程中检测到扩展上下文失效');
          this.handleExtensionContextInvalidated();
          throw new Error('扩展上下文已失效，请刷新页面');
        }

        // 检查翻译是否被取消
        if (!this.isTranslating) {
          console.log('Tidy: 翻译已被取消，停止批量翻译');
          break;
        }

        const originalText = element.textContent.trim();
        if (!originalText) {
          continue;
        }

        console.log(`正在翻译 (${i + 1}/${elements.length}):`, originalText.substring(0, 50) + '...');
        
        try {
          const translation = await this.requestTranslation(originalText, settings);
          
          if (translation) {
            this.applyTranslation(element, originalText, translation, settings.translateMode);
            console.log('翻译完成:', translation.substring(0, 50) + '...');
            results.push({ success: true, element, originalText, translation });
          } else {
            console.warn('翻译返回空结果:', originalText.substring(0, 50) + '...');
            results.push({ success: false, element, originalText, error: '翻译返回空结果' });
          }
        } catch (translationError) {
          console.error('翻译单个元素失败:', translationError.message);
          
          // 如果是上下文失效错误，停止整个批量翻译
          if (translationError.message.includes('扩展上下文已失效')) {
            console.error('Tidy: 扩展上下文失效，停止批量翻译');
            throw translationError;
          }
          
          // 其他错误继续翻译下一个元素
          results.push({ success: false, element, originalText, error: translationError.message });
          
          // 如果连续失败太多，考虑停止
          const recentFailures = results.slice(-5).filter(r => !r.success).length;
          if (recentFailures >= 5) {
            console.warn('Tidy: 连续翻译失败过多，暂停批量翻译');
            this.showNotification('翻译错误过多，已暂停。请检查网络连接和API配置', 'warning');
            break;
          }
        }

        // 在每个翻译之间添加短暂延迟，避免API限流
        if (i < elements.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error('批量翻译过程出错:', error);
        results.push({ success: false, element, error: error.message });
        
        // 如果是严重错误（如上下文失效），停止整个翻译过程
        if (error.message.includes('扩展上下文已失效')) {
          break;
        }
      }
    }

    return results;
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

  // 应用翻译
  applyTranslation(element, originalText, translation, mode) {
    // 标记为已翻译
    element.setAttribute('data-ai-translated', 'true');
    element.setAttribute('data-original-text', originalText);

    // 获取当前显示模式，默认为双语模式
    const displayMode = this.settings.displayMode || 'bilingual';
    
    // 清除之前的翻译内容
    this.clearElementTranslation(element);

    switch (displayMode) {
      case 'replace':
        this.applyReplaceMode(element, originalText, translation);
        break;
      case 'underline':
        this.applyUnderlineMode(element, originalText, translation);
        break;
      case 'highlight':
        this.applyHighlightMode(element, originalText, translation);
        break;
      case 'blur':
        this.applyBlurMode(element, originalText, translation);
        break;
      case 'side-by-side':
        this.applySideBySideMode(element, originalText, translation);
        break;
      case 'bilingual':
      default:
        this.applyBilingualMode(element, originalText, translation);
        break;
    }

    // 记录翻译
    this.translatedElements.set(element, { originalText, translation, mode: displayMode });
    
    // 添加淡入动画
    element.style.opacity = '0.5';
    element.style.transition = 'opacity 0.3s ease';
    requestAnimationFrame(() => {
      element.style.opacity = '1';
    });
  }

  // 清除单个元素的翻译
  clearElementTranslation(element) {
    // 移除翻译相关的类和样式
    element.classList.remove(
      'ai-translation-bilingual', 'ai-translation-underline', 
      'ai-translation-highlight', 'ai-translation-blur',
      'ai-translation-side-by-side', 'ai-translation-replace'
    );
    
    // 移除内联样式
    element.style.removeProperty('background');
    element.style.removeProperty('border-bottom');
    element.style.removeProperty('filter');
    element.style.removeProperty('transition');
    element.style.removeProperty('opacity');
  }

  // 双语模式：原文下方显示译文
  applyBilingualMode(element, originalText, translation) {
    element.classList.add('ai-translation-bilingual');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-translation-wrapper';
    wrapper.style.cssText = `
      line-height: 1.6;
      margin: 4px 0;
    `;

    const originalDiv = document.createElement('div');
    originalDiv.className = 'ai-translation-original';
    originalDiv.textContent = originalText;
    originalDiv.style.cssText = `
      color: #374151;
      margin-bottom: 6px;
      opacity: 0.85;
    `;

    const translationDiv = document.createElement('div');
    translationDiv.className = 'ai-translation-text';
    translationDiv.textContent = translation;
    translationDiv.style.cssText = `
      color: #059669;
      font-weight: 500;
      border-left: 3px solid #10b981;
      padding-left: 8px;
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);
    `;

    wrapper.appendChild(originalDiv);
    wrapper.appendChild(translationDiv);
    element.innerHTML = '';
    element.appendChild(wrapper);
  }

  // 下划线模式：原文带下划线，悬停显示译文
  applyUnderlineMode(element, originalText, translation) {
    element.classList.add('ai-translation-underline');
    element.textContent = originalText;
    element.style.cssText = `
      border-bottom: 2px solid #3b82f6;
      border-radius: 2px;
      cursor: help;
      position: relative;
      transition: all 0.2s ease;
    `;

    // 创建悬停提示
    const tooltip = document.createElement('div');
    tooltip.className = 'ai-translation-tooltip';
    tooltip.textContent = translation;
    tooltip.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      white-space: nowrap;
      max-width: 300px;
      white-space: normal;
      z-index: 1000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    // 添加箭头
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #1f2937;
    `;
    tooltip.appendChild(arrow);

    element.appendChild(tooltip);

    // 悬停事件
    element.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
      element.style.borderBottomColor = '#1d4ed8';
    });

    element.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      element.style.borderBottomColor = '#3b82f6';
    });
  }

  // 高亮模式：原文高亮背景，点击切换显示
  applyHighlightMode(element, originalText, translation) {
    element.classList.add('ai-translation-highlight');
    element.textContent = originalText;
    element.style.cssText = `
      background: linear-gradient(120deg, #fef3c7 0%, #fcd34d 100%);
      padding: 2px 4px;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid transparent;
    `;

    let showingTranslation = false;

    element.addEventListener('click', () => {
      if (showingTranslation) {
        element.textContent = originalText;
        element.style.background = 'linear-gradient(120deg, #fef3c7 0%, #fcd34d 100%)';
        showingTranslation = false;
      } else {
        element.textContent = translation;
        element.style.background = 'linear-gradient(120deg, #dcfce7 0%, #86efac 100%)';
        showingTranslation = true;
      }
    });

    element.addEventListener('mouseenter', () => {
      element.style.borderColor = '#f59e0b';
      element.style.transform = 'scale(1.02)';
    });

    element.addEventListener('mouseleave', () => {
      element.style.borderColor = 'transparent';
      element.style.transform = 'scale(1)';
    });
  }

  // 模糊模式：原文模糊，悬停显示译文
  applyBlurMode(element, originalText, translation) {
    element.classList.add('ai-translation-blur');
    element.textContent = originalText;
    element.style.cssText = `
      filter: blur(3px);
      transition: filter 0.3s ease;
      cursor: pointer;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 4px;
      padding: 2px 4px;
    `;

    let showingTranslation = false;

    const toggleDisplay = () => {
      if (showingTranslation) {
        element.textContent = originalText;
        element.style.filter = 'blur(3px)';
        element.style.background = 'rgba(99, 102, 241, 0.1)';
        showingTranslation = false;
      } else {
        element.textContent = translation;
        element.style.filter = 'none';
        element.style.background = 'rgba(16, 185, 129, 0.1)';
        showingTranslation = true;
      }
    };

    element.addEventListener('mouseenter', () => {
      if (!showingTranslation) {
        element.style.filter = 'blur(1px)';
      }
    });

    element.addEventListener('mouseleave', () => {
      if (!showingTranslation) {
        element.style.filter = 'blur(3px)';
      }
    });

    element.addEventListener('click', toggleDisplay);
  }

  // 并排模式：原文和译文左右显示
  applySideBySideMode(element, originalText, translation) {
    element.classList.add('ai-translation-side-by-side');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-translation-side-wrapper';
    wrapper.style.cssText = `
      display: flex;
      gap: 16px;
      align-items: flex-start;
      border-left: 3px solid #6366f1;
      padding-left: 12px;
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.05) 0%, transparent 50%);
      border-radius: 4px;
    `;

    const originalDiv = document.createElement('div');
    originalDiv.className = 'ai-translation-original-side';
    originalDiv.textContent = originalText;
    originalDiv.style.cssText = `
      flex: 1;
      color: #4b5563;
      font-size: 0.95em;
      opacity: 0.8;
    `;

    const translationDiv = document.createElement('div');
    translationDiv.className = 'ai-translation-text-side';
    translationDiv.textContent = translation;
    translationDiv.style.cssText = `
      flex: 1;
      color: #059669;
      font-weight: 500;
    `;

    wrapper.appendChild(originalDiv);
    wrapper.appendChild(translationDiv);
    element.innerHTML = '';
    element.appendChild(wrapper);
  }

  // 替换模式：直接显示译文
  applyReplaceMode(element, originalText, translation) {
    element.classList.add('ai-translation-replace');
    element.textContent = translation;
    element.style.cssText = `
      color: #059669;
      font-style: italic;
      border-radius: 3px;
      padding: 1px 3px;
      background: rgba(16, 185, 129, 0.08);
      transition: background 0.2s ease;
    `;

    element.addEventListener('mouseenter', () => {
      element.style.background = 'rgba(16, 185, 129, 0.15)';
    });

    element.addEventListener('mouseleave', () => {
      element.style.background = 'rgba(16, 185, 129, 0.08)';
    });
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
    popup.innerHTML = `<div style="font-size:15px;line-height:1.7;white-space:pre-line;padding:10px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:420px;min-width:180px;">
      <div style='color:#666;margin-bottom:4px;'>${originalText}</div>
      <div style='color:#222;font-weight:500;'>${translation}</div>
    </div>`;
    popup.style.position = 'fixed';
    popup.style.left = (rect.left + window.scrollX) + 'px';
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    popup.style.zIndex = 10010;
    popup.style.pointerEvents = 'auto';
    popup.style.transition = 'opacity 0.2s';
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
  showNotification(message, type = 'info', timeout = null) {
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

    // 确定显示时间：自定义超时 > 上下文失效错误 > 默认时间
    let displayTime;
    if (timeout !== null) {
      displayTime = timeout;
    } else if (message.includes('扩展上下文已失效')) {
      displayTime = 8000;
    } else {
      displayTime = 3000;
    }
    
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, displayTime);
  }

  // 智能内容分段优化
  optimizeContentSegmentation(elements) {
    console.log('Tidy: 开始内容分段优化');
    
    // 按容器分组相关元素
    const groupedElements = this.groupElementsByContainer(elements);
    
    // 合并短文本片段
    const mergedGroups = this.mergeShortTextSegments(groupedElements);
    
    // 分离长文本段落
    const optimizedSegments = this.splitLongTextSegments(mergedGroups);
    
    console.log(`Tidy: 分段优化完成，原始 ${elements.length} 个元素，优化后 ${optimizedSegments.length} 个片段`);
    
    return optimizedSegments;
  }

  // 按容器分组元素
  groupElementsByContainer(elements) {
    const groups = [];
    const visited = new Set();
    
    elements.forEach(element => {
      if (visited.has(element)) return;
      
      // 查找同一容器下的相关元素
      const container = this.findContentContainer(element);
      const relatedElements = elements.filter(el => 
        !visited.has(el) && 
        this.findContentContainer(el) === container &&
        this.areElementsRelated(element, el)
      );
      
      if (relatedElements.length > 1) {
        // 创建组合片段
        const combinedText = relatedElements
          .map(el => el.textContent.trim())
          .filter(text => text.length > 0)
          .join('\n\n');
          
        if (combinedText.length > 0) {
          groups.push({
            type: 'grouped',
            elements: relatedElements,
            text: combinedText,
            container: container
          });
          
          relatedElements.forEach(el => visited.add(el));
        }
      } else if (!visited.has(element)) {
        // 单独的元素
        const text = element.textContent.trim();
        if (text.length > 0) {
          groups.push({
            type: 'single',
            elements: [element],
            text: text,
            container: container
          });
          visited.add(element);
        }
      }
    });
    
    return groups;
  }

  // 查找内容容器
  findContentContainer(element) {
    let current = element;
    
    // 向上查找到合适的容器级别
    while (current && current !== document.body) {
      // 检查是否是明确的内容容器
      if (this.isContentContainer(current)) {
        return current;
      }
      current = current.parentElement;
    }
    
    return element.parentElement || document.body;
  }

  // 判断是否是内容容器
  isContentContainer(element) {
    const contentContainerSelectors = [
      'article', 'section', 'main', '.content', '.post', '.entry',
      '.message', '.comment', '.card', '.item', '[role="article"]'
    ];
    
    return contentContainerSelectors.some(selector => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
  }

  // 判断元素是否相关
  areElementsRelated(element1, element2) {
    // 检查DOM距离
    const domDistance = this.calculateDOMDistance(element1, element2);
    if (domDistance > 3) return false;
    
    // 检查文本相似性
    const textSimilarity = this.calculateTextSimilarity(
      element1.textContent, 
      element2.textContent
    );
    
    // 检查视觉位置
    const visualDistance = this.calculateVisualDistance(element1, element2);
    
    // 综合判断
    return (
      domDistance <= 2 || 
      textSimilarity > 0.3 || 
      (visualDistance < 100 && domDistance <= 3)
    );
  }

  // 计算DOM距离
  calculateDOMDistance(element1, element2) {
    const getDepth = (el) => {
      let depth = 0;
      while (el && el !== document.body) {
        depth++;
        el = el.parentElement;
      }
      return depth;
    };
    
    const depth1 = getDepth(element1);
    const depth2 = getDepth(element2);
    
    return Math.abs(depth1 - depth2);
  }

  // 计算文本相似性（简单版本）
  calculateTextSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => 
      word.length > 2 && words2.includes(word)
    );
    
    const maxLength = Math.max(words1.length, words2.length);
    return maxLength > 0 ? commonWords.length / maxLength : 0;
  }

  // 计算视觉距离
  calculateVisualDistance(element1, element2) {
    try {
      const rect1 = element1.getBoundingClientRect();
      const rect2 = element2.getBoundingClientRect();
      
      const center1 = {
        x: rect1.left + rect1.width / 2,
        y: rect1.top + rect1.height / 2
      };
      
      const center2 = {
        x: rect2.left + rect2.width / 2,
        y: rect2.top + rect2.height / 2
      };
      
      return Math.sqrt(
        Math.pow(center1.x - center2.x, 2) + 
        Math.pow(center1.y - center2.y, 2)
      );
    } catch (e) {
      return Infinity;
    }
  }

  // 合并短文本片段
  mergeShortTextSegments(groups) {
    const merged = [];
    let currentBatch = [];
    let currentBatchLength = 0;
    const maxBatchLength = 500; // 最大合并长度
    const minSegmentLength = 50; // 最小片段长度
    
    groups.forEach(group => {
      if (group.text.length < minSegmentLength && currentBatchLength < maxBatchLength) {
        // 添加到当前批次
        currentBatch.push(group);
        currentBatchLength += group.text.length;
      } else {
        // 完成当前批次
        if (currentBatch.length > 0) {
          if (currentBatch.length > 1) {
            merged.push({
              type: 'merged',
              elements: currentBatch.flatMap(g => g.elements),
              text: currentBatch.map(g => g.text).join('\n\n'),
              originalGroups: currentBatch
            });
          } else {
            merged.push(currentBatch[0]);
          }
          currentBatch = [];
          currentBatchLength = 0;
        }
        
        // 添加当前组
        merged.push(group);
      }
    });
    
    // 处理剩余的批次
    if (currentBatch.length > 0) {
      if (currentBatch.length > 1) {
        merged.push({
          type: 'merged',
          elements: currentBatch.flatMap(g => g.elements),
          text: currentBatch.map(g => g.text).join('\n\n'),
          originalGroups: currentBatch
        });
      } else {
        merged.push(currentBatch[0]);
      }
    }
    
    return merged;
  }

  // 分离长文本段落
  splitLongTextSegments(groups) {
    const maxSegmentLength = 1000; // 最大段落长度
    const result = [];
    
    groups.forEach(group => {
      if (group.text.length <= maxSegmentLength) {
        result.push(group);
      } else {
        // 分割长文本
        const sentences = this.splitIntoSentences(group.text);
        let currentSegment = '';
        let currentElements = [];
        
        sentences.forEach(sentence => {
          if (currentSegment.length + sentence.length > maxSegmentLength && currentSegment.length > 0) {
            // 创建新的片段
            result.push({
              type: 'split',
              elements: group.elements, // 保持原始元素引用
              text: currentSegment.trim(),
              originalGroup: group,
              partIndex: result.filter(r => r.originalGroup === group).length
            });
            currentSegment = sentence;
          } else {
            currentSegment += (currentSegment ? ' ' : '') + sentence;
          }
        });
        
        // 添加最后一个片段
        if (currentSegment.trim()) {
          result.push({
            type: 'split',
            elements: group.elements,
            text: currentSegment.trim(),
            originalGroup: group,
            partIndex: result.filter(r => r.originalGroup === group).length
          });
        }
      }
    });
    
    return result;
  }

  // 分割句子
  splitIntoSentences(text) {
    // 简单的句子分割，支持多种语言
    const sentenceEnders = /[.!?;。！？；]/g;
    const sentences = text.split(sentenceEnders).filter(s => s.trim().length > 0);
    
    // 如果分割结果太少，按长度分割
    if (sentences.length < 2 && text.length > 500) {
      const chunks = [];
      const chunkSize = 200;
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }
      return chunks;
    }
    
    return sentences;
  }

  // 对分段应用翻译
  async applySegmentTranslation(segment, originalText, translation, mode) {
    switch (segment.type) {
      case 'single':
        // 单个元素，直接应用翻译
        if (segment.elements.length > 0) {
          this.applyTranslation(segment.elements[0], originalText, translation, mode);
        }
        break;
        
      case 'grouped':
        // 组合元素，需要分割翻译结果
        await this.applyGroupedTranslation(segment, originalText, translation, mode);
        break;
        
      case 'merged':
        // 合并的短文本，需要分割翻译结果
        await this.applyMergedTranslation(segment, originalText, translation, mode);
        break;
        
      case 'split':
        // 分割的长文本，应用到原始元素
        if (segment.elements.length > 0) {
          this.applySplitTranslation(segment, originalText, translation, mode);
        }
        break;
        
      default:
        console.warn('Tidy: 未知的片段类型:', segment.type);
        break;
    }
  }

  // 应用组合翻译
  async applyGroupedTranslation(segment, originalText, translation, mode) {
    // 简单的分割策略：按原文比例分配译文
    const originalTexts = segment.elements.map(el => el.textContent.trim());
    const totalOriginalLength = originalTexts.reduce((sum, text) => sum + text.length, 0);
    
    if (totalOriginalLength === 0) return;
    
    // 尝试智能分割译文
    const translationParts = this.splitTranslationByRatio(translation, originalTexts);
    
    segment.elements.forEach((element, index) => {
      if (index < translationParts.length && originalTexts[index]) {
        this.applyTranslation(element, originalTexts[index], translationParts[index], mode);
      }
    });
  }

  // 应用合并翻译
  async applyMergedTranslation(segment, originalText, translation, mode) {
    // 为每个原始组分配翻译部分
    const originalGroups = segment.originalGroups;
    const translationParts = this.splitTranslationByGroups(translation, originalGroups);
    
    originalGroups.forEach((group, index) => {
      if (index < translationParts.length) {
        group.elements.forEach(element => {
          const elementText = element.textContent.trim();
          if (elementText) {
            this.applyTranslation(element, elementText, translationParts[index], mode);
          }
        });
      }
    });
  }

  // 应用分割翻译
  applySplitTranslation(segment, originalText, translation, mode) {
    // 对于分割的文本，我们创建一个虚拟容器来显示翻译
    const elements = segment.elements;
    if (elements.length === 0) return;
    
    const primaryElement = elements[0];
    
    // 如果是第一个分割部分，清除原有内容并开始显示翻译
    if (segment.partIndex === 0) {
      this.clearElementTranslation(primaryElement);
      
      // 创建分割翻译容器
      const container = document.createElement('div');
      container.className = 'ai-translation-split-container';
      container.setAttribute('data-split-group', segment.originalGroup.text.substring(0, 50));
      container.style.cssText = `
        border-left: 3px solid #8b5cf6;
        padding-left: 12px;
        margin: 8px 0;
        background: linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%);
        border-radius: 4px;
      `;
      
      // 添加原文标题
      const originalTitle = document.createElement('div');
      originalTitle.className = 'ai-translation-split-original';
      originalTitle.textContent = segment.originalGroup.text;
      originalTitle.style.cssText = `
        color: #6b7280;
        font-size: 0.9em;
        margin-bottom: 8px;
        opacity: 0.8;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 4px;
      `;
      
      container.appendChild(originalTitle);
      
      // 插入到主元素中
      primaryElement.innerHTML = '';
      primaryElement.appendChild(container);
      primaryElement.setAttribute('data-ai-translated', 'true');
      primaryElement.setAttribute('data-original-text', segment.originalGroup.text);
      
      // 记录到翻译映射
      this.translatedElements.set(primaryElement, {
        originalText: segment.originalGroup.text,
        translation: translation,
        mode: mode,
        segmentType: 'split',
        container: container
      });
    }
    
    // 添加当前分割部分的翻译
    const existingContainer = primaryElement.querySelector('.ai-translation-split-container');
    if (existingContainer) {
      const translationPart = document.createElement('div');
      translationPart.className = 'ai-translation-split-part';
      translationPart.textContent = translation;
      translationPart.style.cssText = `
        color: #059669;
        font-weight: 500;
        margin-bottom: 6px;
        line-height: 1.6;
      `;
      
      existingContainer.appendChild(translationPart);
    }
  }

  // 按比例分割翻译文本
  splitTranslationByRatio(translation, originalTexts) {
    const totalLength = originalTexts.reduce((sum, text) => sum + text.length, 0);
    if (totalLength === 0) return [translation];
    
    const parts = [];
    let remainingTranslation = translation;
    
    for (let i = 0; i < originalTexts.length; i++) {
      const ratio = originalTexts[i].length / totalLength;
      const partLength = Math.round(translation.length * ratio);
      
      if (i === originalTexts.length - 1) {
        // 最后一部分，使用剩余的所有内容
        parts.push(remainingTranslation);
      } else {
        // 尝试在合适的位置分割
        const cutPoint = this.findSuitableCutPoint(remainingTranslation, partLength);
        const part = remainingTranslation.substring(0, cutPoint);
        parts.push(part);
        remainingTranslation = remainingTranslation.substring(cutPoint);
      }
    }
    
    return parts;
  }

  // 按组分割翻译文本
  splitTranslationByGroups(translation, groups) {
    // 简单策略：按段落分割
    const paragraphs = translation.split(/\n\n+/);
    
    // 如果段落数量匹配组数量，直接对应
    if (paragraphs.length === groups.length) {
      return paragraphs;
    }
    
    // 否则按比例分配
    const groupTexts = groups.map(g => g.text);
    return this.splitTranslationByRatio(translation, groupTexts);
  }

  // 查找合适的分割点
  findSuitableCutPoint(text, targetLength) {
    if (targetLength >= text.length) return text.length;
    
    // 在目标长度附近查找句子或标点符号
    const searchRange = Math.min(50, Math.floor(text.length * 0.1));
    const startSearch = Math.max(0, targetLength - searchRange);
    const endSearch = Math.min(text.length, targetLength + searchRange);
    
    // 查找句子分隔符
    const sentenceEnders = /[.!?。！？]/g;
    let match;
    let bestCut = targetLength;
    let minDistance = Infinity;
    
    while ((match = sentenceEnders.exec(text)) !== null) {
      if (match.index >= startSearch && match.index <= endSearch) {
        const distance = Math.abs(match.index - targetLength);
        if (distance < minDistance) {
          minDistance = distance;
          bestCut = match.index + 1;
        }
      }
    }
    
    // 如果没找到合适的句子分隔符，查找空格
    if (minDistance === Infinity) {
      for (let i = startSearch; i <= endSearch; i++) {
        if (text[i] === ' ' || text[i] === '\n') {
          const distance = Math.abs(i - targetLength);
          if (distance < minDistance) {
            minDistance = distance;
            bestCut = i;
          }
        }
      }
    }
    
    return bestCut;
  }

  // 创建翻译动画和视觉反馈
  createTranslationVisualEffects() {
    // 添加全局动画样式
    if (!document.getElementById('ai-translator-animations')) {
      const style = document.createElement('style');
      style.id = 'ai-translator-animations';
      style.textContent = `
        @keyframes ai-translate-pulse {
          0% { background-color: rgba(99, 102, 241, 0.1); }
          50% { background-color: rgba(99, 102, 241, 0.2); }
          100% { background-color: rgba(99, 102, 241, 0.1); }
        }
        
        @keyframes ai-translate-fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes ai-translate-slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes ai-translate-highlight {
          0% { background-color: transparent; }
          50% { background-color: rgba(34, 197, 94, 0.2); }
          100% { background-color: rgba(34, 197, 94, 0.1); }
        }
        
        .ai-translating {
          animation: ai-translate-pulse 2s infinite;
          position: relative;
          border-radius: 4px;
          transition: all 0.3s ease;
        }
        
        .ai-translating::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1);
          background-size: 200% 100%;
          animation: ai-translate-progress 2s infinite;
          border-radius: 2px;
        }
        
        @keyframes ai-translate-progress {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .ai-translation-completed {
          animation: ai-translate-highlight 1s ease-out;
        }
        
        .ai-translation-wrapper {
          animation: ai-translate-fadeIn 0.5s ease-out;
        }
        
        .ai-translation-text {
          animation: ai-translate-slideIn 0.3s ease-out 0.2s both;
        }
        
        .ai-translation-tooltip {
          animation: ai-translate-fadeIn 0.2s ease-out;
        }
        
        .ai-translation-split-part {
          animation: ai-translate-slideIn 0.4s ease-out;
        }
        
        .ai-translator-notification {
          animation: ai-translate-slideIn 0.3s ease-out;
        }
        
        /* 翻译中的元素样式 */
        .ai-element-translating {
          position: relative;
          overflow: hidden;
        }
        
        .ai-element-translating::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: ai-translate-shimmer 1.5s infinite;
        }
        
        @keyframes ai-translate-shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        /* 加载指示器 */
        .ai-translation-loader {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #e5e7eb;
          border-top: 2px solid #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        }
        
        /* 成功指示器 */
        .ai-translation-success {
          color: #059669;
          font-weight: 500;
        }
        
        /* 错误指示器 */
        .ai-translation-error {
          color: #dc2626;
          text-decoration: line-through;
          opacity: 0.7;
        }
        
        /* 跳跃动画 */
        @keyframes ai-translate-bounce {
          0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
          40%, 43% { transform: translate3d(0, -8px, 0); }
          70% { transform: translate3d(0, -4px, 0); }
          90% { transform: translate3d(0, -2px, 0); }
        }
        
        .ai-translation-bounce {
          animation: ai-translate-bounce 1s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // 添加翻译中的视觉效果
  addTranslatingEffect(element) {
    element.classList.add('ai-translating', 'ai-element-translating');
    
    // 添加微妙的加载指示器
    const loader = document.createElement('span');
    loader.className = 'ai-translation-loader';
    loader.style.cssText = `
      position: absolute;
      top: -15px;
      right: -15px;
      z-index: 1000;
      background: white;
      border-radius: 50%;
      padding: 2px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    // 确保元素有相对定位
    const originalPosition = getComputedStyle(element).position;
    if (originalPosition === 'static') {
      element.style.position = 'relative';
    }
    
    element.appendChild(loader);
    element.setAttribute('data-translation-loader', 'true');
  }

  // 移除翻译中的视觉效果
  removeTranslatingEffect(element, success = true) {
    element.classList.remove('ai-translating', 'ai-element-translating');
    
    // 移除加载指示器
    const loader = element.querySelector('.ai-translation-loader');
    if (loader) {
      loader.remove();
    }
    
    // 添加完成动画
    if (success) {
      element.classList.add('ai-translation-completed');
      // 添加弹跳效果
      setTimeout(() => {
        element.classList.add('ai-translation-bounce');
      }, 100);
      
      // 清理动画类
      setTimeout(() => {
        element.classList.remove('ai-translation-completed', 'ai-translation-bounce');
      }, 1500);
    } else {
      element.classList.add('ai-translation-error');
    }
    
    // 重置position属性
    if (element.hasAttribute('data-translation-loader')) {
      element.removeAttribute('data-translation-loader');
      const originalPosition = element.getAttribute('data-original-position');
      if (originalPosition) {
        element.style.position = originalPosition;
        element.removeAttribute('data-original-position');
      } else {
        element.style.position = '';
      }
    }
  }

  // 创建段落级别的翻译进度指示器
  createSegmentProgressIndicator(segments) {
    // 创建全局进度指示器
    const progressContainer = document.createElement('div');
    progressContainer.id = 'ai-translator-segment-progress';
    progressContainer.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      z-index: 10005;
      min-width: 280px;
      max-width: 400px;
      border: 1px solid #e5e7eb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: ai-translate-fadeIn 0.3s ease-out;
    `;
    
    const title = document.createElement('div');
    title.textContent = '翻译进度';
    title.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    `;
    
    const titleIcon = document.createElement('span');
    titleIcon.innerHTML = '🌐';
    titleIcon.style.marginRight = '8px';
    title.insertBefore(titleIcon, title.firstChild);
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.cssText = `
      width: 100%;
      height: 8px;
      background: #f3f4f6;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      width: 0%;
      transition: width 0.3s ease;
      border-radius: 4px;
    `;
    
    progressBar.appendChild(progressFill);
    
    const statusText = document.createElement('div');
    statusText.className = 'status-text';
    statusText.style.cssText = `
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    `;
    
    const statsText = document.createElement('div');
    statsText.className = 'stats-text';
    statsText.style.cssText = `
      font-size: 12px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    `;
    
    progressContainer.appendChild(title);
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(statusText);
    progressContainer.appendChild(statsText);
    
    document.body.appendChild(progressContainer);
    
    return {
      container: progressContainer,
      progressFill: progressFill,
      statusText: statusText,
      statsText: statsText
    };
  }

  // 更新段落进度指示器
  updateSegmentProgress(indicator, processed, total, success, failed, poolStats) {
    const percentage = Math.round((processed / total) * 100);
    
    indicator.progressFill.style.width = `${percentage}%`;
    indicator.statusText.textContent = `${processed}/${total} 个片段已翻译`;
    
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    indicator.statsText.innerHTML = `
      <span style="color: #059669;">✓ ${success}</span>
      <span style="color: #dc2626;">✗ ${failed}</span>
      <span style="color: #6366f1;">${poolStats.rate}</span>
    `;
    
    // 更新颜色
    if (failed > success * 0.5) {
      indicator.progressFill.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
    } else if (successRate > 80) {
      indicator.progressFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    }
  }

  // 隐藏段落进度指示器
  hideSegmentProgress() {
    const indicator = document.getElementById('ai-translator-segment-progress');
    if (indicator) {
      indicator.style.animation = 'ai-translate-fadeIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }
      }, 300);
    }
  }

  // 增强的错误处理和重试机制
  async requestTranslationWithAdvancedRetry(text, settings) {
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // 递增延迟
    let lastError = null;
    
    // 错误类型分类
    const errorTypes = {
      NETWORK: 'network',
      API_QUOTA: 'quota', 
      API_ERROR: 'api',
      TIMEOUT: 'timeout',
      CONTEXT: 'context',
      UNKNOWN: 'unknown'
    };
    
    const classifyError = (error) => {
      const message = error.message.toLowerCase();
      
      if (message.includes('扩展上下文') || message.includes('context invalidated')) {
        return errorTypes.CONTEXT;
      } else if (message.includes('timeout') || message.includes('超时')) {
        return errorTypes.TIMEOUT;
      } else if (message.includes('quota') || message.includes('limit') || message.includes('配额')) {
        return errorTypes.API_QUOTA;
      } else if (message.includes('network') || message.includes('连接') || message.includes('fetch')) {
        return errorTypes.NETWORK;
      } else if (message.includes('api') || message.includes('翻译')) {
        return errorTypes.API_ERROR;
      } else {
        return errorTypes.UNKNOWN;
      }
    };
    
    const shouldRetry = (errorType, retryCount) => {
      switch (errorType) {
        case errorTypes.CONTEXT:
          return false; // 上下文失效不重试
        case errorTypes.API_QUOTA:
          return retryCount < 2; // 配额错误最多重试2次
        case errorTypes.NETWORK:
        case errorTypes.TIMEOUT:
          return retryCount < maxRetries; // 网络问题全力重试
        case errorTypes.API_ERROR:
          return retryCount < 2; // API错误适度重试
        case errorTypes.UNKNOWN:
          return retryCount < 1; // 未知错误谨慎重试
        default:
          return false;
      }
    };
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 检查扩展上下文
        if (!chrome.runtime?.id) {
          throw new Error('扩展上下文已失效');
        }
        
        // 检查翻译是否被取消
        if (!this.isTranslating) {
          throw new Error('翻译已被取消');
        }
        
        const result = await this.requestTranslation(text, settings);
        
        // 成功则返回结果
        if (result && result.trim()) {
          return result;
        } else {
          throw new Error('翻译返回空结果');
        }
        
      } catch (error) {
        lastError = error;
        const errorType = classifyError(error);
        
        console.warn(`翻译尝试 ${attempt + 1}/${maxRetries + 1} 失败 (${errorType}):`, error.message);
        
        // 如果是最后一次尝试或不应该重试，直接抛出错误
        if (attempt === maxRetries || !shouldRetry(errorType, attempt)) {
          throw error;
        }
        
        // 根据错误类型调整重试策略
        let delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
        
        if (errorType === errorTypes.API_QUOTA) {
          delay *= 2; // 配额错误延长等待时间
        } else if (errorType === errorTypes.NETWORK) {
          delay *= 1.5; // 网络错误适当延长
        }
        
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // 如果所有重试都失败了
    throw lastError || new Error('翻译失败，已达到最大重试次数');
  }

  // 批量错误恢复策略
  async handleBatchErrors(results, segments, settings) {
    const failedResults = results
      .map((result, index) => ({ result, index, segment: segments[index] }))
      .filter(item => item.result.status === 'rejected' || !item.result.value?.success);
    
    if (failedResults.length === 0) {
      return results;
    }
    
    console.log(`Tidy: 检测到 ${failedResults.length} 个失败的翻译，尝试恢复...`);
    
    // 对失败的翻译进行分类和恢复
    const recoveryPromises = failedResults.map(async (item) => {
      try {
        const error = item.result.reason || item.result.value?.error;
        const errorType = this.classifyTranslationError(error);
        
        // 根据错误类型采用不同的恢复策略
        switch (errorType) {
          case 'quota':
            // 配额错误：降低文本长度重试
            return await this.retryWithShorterText(item.segment, settings);
          
          case 'network':
            // 网络错误：简单重试
            return await this.requestTranslationWithAdvancedRetry(item.segment.text, settings);
          
          case 'timeout':
            // 超时错误：分割文本重试
            return await this.retryWithTextSplitting(item.segment, settings);
          
          default:
            // 其他错误：使用备用翻译策略
            return await this.fallbackTranslation(item.segment.text, settings);
        }
      } catch (recoveryError) {
        console.warn(`恢复第 ${item.index + 1} 个片段失败:`, recoveryError.message);
        return null;
      }
    });
    
    const recoveryResults = await Promise.allSettled(recoveryPromises);
    
    // 统计恢复结果
    const recovered = recoveryResults.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`Tidy: 成功恢复 ${recovered}/${failedResults.length} 个失败的翻译`);
    
    return results; // 返回原始结果，恢复在后台进行
  }
  
  // 分类翻译错误
  classifyTranslationError(error) {
    if (!error) return 'unknown';
    
    const message = typeof error === 'string' ? error : error.message || '';
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
      return 'quota';
    } else if (lowerMessage.includes('timeout') || lowerMessage.includes('超时')) {
      return 'timeout';
    } else if (lowerMessage.includes('network') || lowerMessage.includes('连接')) {
      return 'network';
    } else {
      return 'unknown';
    }
  }
  
  // 使用较短文本重试
  async retryWithShorterText(segment, settings) {
    const originalText = segment.text;
    
    // 截取前一半文本
    const shorterText = originalText.substring(0, Math.floor(originalText.length / 2));
    
    if (shorterText.length < 10) {
      throw new Error('文本过短，无法进一步缩减');
    }
    
    console.log('尝试使用较短文本重试翻译...');
    const result = await this.requestTranslationWithAdvancedRetry(shorterText, settings);
    
    // 应用部分翻译
    if (result && segment.elements.length > 0) {
      await this.applySegmentTranslation(segment, shorterText, result + '...', settings.translateMode);
    }
    
    return result;
  }
  
  // 通过分割文本重试
  async retryWithTextSplitting(segment, settings) {
    const originalText = segment.text;
    const chunks = this.splitTextIntoChunks(originalText, 200); // 分割成200字符的块
    
    console.log(`分割文本为 ${chunks.length} 个块进行重试...`);
    
    const chunkTranslations = [];
    for (const chunk of chunks) {
      try {
        const translation = await this.requestTranslationWithAdvancedRetry(chunk, settings);
        chunkTranslations.push(translation);
      } catch (error) {
        console.warn('分块翻译失败:', error.message);
        chunkTranslations.push(`[翻译失败: ${chunk.substring(0, 20)}...]`);
      }
    }
    
    const combinedTranslation = chunkTranslations.join(' ');
    
    // 应用合并的翻译
    if (segment.elements.length > 0) {
      await this.applySegmentTranslation(segment, originalText, combinedTranslation, settings.translateMode);
    }
    
    return combinedTranslation;
  }
  
  // 备用翻译策略
  async fallbackTranslation(text, settings) {
    // 简化的本地翻译策略（示例）
    console.log('使用备用翻译策略...');
    
    // 这里可以接入其他翻译服务或本地翻译
    // 目前返回一个简单的备用结果
    return `[备用翻译] ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`;
  }
  
  // 分割文本为块
  splitTextIntoChunks(text, maxChunkSize) {
    const chunks = [];
    let currentChunk = '';
    const sentences = text.split(/[.!?。！？]/);
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
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