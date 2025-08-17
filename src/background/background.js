// background.js - 后台服务脚本

class BackgroundService {
  constructor() {
    this.translationService = new TranslationService();
    this.init();
  }

  // 初始化
  init() {
    this.setupMessageListener();
    this.setupContextMenus();
    this.setupInstallHandler();
    this.setupCommandsListener();
  }

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        // 检查扩展上下文是否有效
        if (!chrome.runtime?.id) {
          console.error('Background: 扩展上下文无效');
          sendResponse({ success: false, error: 'Extension context invalidated' });
          return true;
        }
        
        this.handleMessage(message, sender, sendResponse);
      } catch (error) {
        console.error('Background message handler error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true; // 保持消息通道开放
    });
  }

  // 处理消息
  async handleMessage(message, sender, sendResponse) {
    try {
      // 再次检查扩展上下文
      if (!chrome.runtime?.id) {
        sendResponse({ success: false, error: 'Extension context invalidated' });
        return;
      }

      switch (message.action) {
        case 'translate':
          try {
            // 添加超时处理
            const timeoutPromise = new Promise((_, reject) => {
              // 根据模型设置不同的超时时间
              const timeoutMs = message.settings?.aiModel === 'qwen3' ? 90000 : 60000;
              setTimeout(() => {
                reject(new Error(`翻译请求超时 (${timeoutMs / 1000}秒)，请检查网络连接`));
              }, timeoutMs);
            });

            const translationPromise = this.translationService.translate(
              message.text,
              message.settings
            );

            const translation = await Promise.race([translationPromise, timeoutPromise]);
            sendResponse({ success: true, translation });
          } catch (error) {
            console.error('Translation error in background:', error);
            
            // 根据错误类型提供更具体的错误信息
            let errorMessage = error.message;
            if (error.message.includes('timeout')) {
              errorMessage = '翻译请求超时，请检查网络连接';
            } else if (error.message.includes('API error: 401')) {
              errorMessage = 'API密钥无效或已过期，请检查配置';
            } else if (error.message.includes('API error: 429')) {
              errorMessage = 'API调用频率超限，请稍后重试';
            } else if (error.message.includes('API error: 403')) {
              errorMessage = 'API访问被拒绝，请检查权限和余额';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
              errorMessage = '网络连接失败，请检查网络连接';
            }
            
            sendResponse({ success: false, error: errorMessage });
          }
          break;

        case 'testAPI':
          try {
            const testResult = await this.translationService.testAPI(message.settings);
            sendResponse(testResult);
          } catch (error) {
            console.error('API test error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'getSettings':
          try {
            const settings = await this.getSettings();
            sendResponse({ success: true, settings });
          } catch (error) {
            console.error('Get settings error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'saveSettings':
          try {
            await this.saveSettings(message.settings);
            sendResponse({ success: true });
          } catch (error) {
            console.error('Save settings error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'detectOllamaModels':
          try {
            const models = await this.detectOllamaModels();
            sendResponse({ success: true, models });
          } catch (error) {
            console.error('Detect Ollama models error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // 设置右键菜单
  setupContextMenus() {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'translate-selection',
        title: '翻译选中文本',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'translate-page',
        title: '翻译整个页面',
        contexts: ['page']
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  // 处理右键菜单点击
  async handleContextMenuClick(info, tab) {
    try {
      const settings = await this.getSettings();
      
      // 检查API密钥是否配置
      if (!settings.apiKey) {
        // 弹出设置页面，提示用户配置API密钥
        chrome.tabs.create({
          url: chrome.runtime.getURL('src/popup/popup.html')
        });
        return;
      }
      
      if (info.menuItemId === 'translate-selection' && info.selectionText) {
        // 翻译选中文本
        const translation = await this.translationService.translate(
          info.selectionText,
          settings
        );
        
        chrome.tabs.sendMessage(tab.id, {
          action: 'showTranslationResult',
          originalText: info.selectionText,
          translation: translation
        });
      } else if (info.menuItemId === 'translate-page') {
        // 翻译整个页面
        chrome.tabs.sendMessage(tab.id, {
          action: 'translatePage',
          settings: settings
        });
      }
    } catch (error) {
      console.error('Context menu handler error:', error);
      // 如果是 Qwen3 相关错误，主动通知 content script 弹窗
      if (error && error.message) {
        if (tab && tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showNotification',
            message: `模型访问失败：${error.message}`,
            type: 'error'
          }, (response) => {
            if (chrome.runtime.lastError) {
              // 静默处理，不再抛出异常
              console.warn('Content script not available:', chrome.runtime.lastError.message);
            }
          });
        }
      }
    }
  }

  // 设置安装处理器
  setupInstallHandler() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        // 首次安装时设置默认值
        this.setDefaultSettings();
        
        // 打开欢迎页面
        chrome.tabs.create({
          url: chrome.runtime.getURL('src/welcome/welcome.html')
        });
      } else if (details.reason === 'update') {
        // 更新时的处理
        console.log('Extension updated to version:', chrome.runtime.getManifest().version);
      }
    });
  }

  // 设置快捷键监听器
  setupCommandsListener() {
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });
  }

  // 处理快捷键命令
  async handleCommand(command) {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const settings = await this.getSettings();

      switch (command) {
        case 'translate-page':
          // 翻译当前页面
          chrome.tabs.sendMessage(tab.id, {
            action: 'translatePage',
            settings: settings
          });
          break;

        case 'toggle-translation':
          // 切换翻译状态
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleTranslation'
          });
          break;
      }
    } catch (error) {
      console.error('Command handler error:', error);
    }
  }

  // 设置默认设置
  async setDefaultSettings() {
    const defaultSettings = {
      translateEnabled: false,
      aiModel: 'openai-gpt35',
      sourceLang: 'auto',
      targetLang: 'zh',
      translateMode: 'bilingual',
      apiKey: '',
      customEndpoint: '',
      usageCount: 0,
      installDate: Date.now()
    };

    await chrome.storage.sync.set(defaultSettings);
  }

  // 获取设置
  async getSettings() {
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

      return {
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
      console.error('Error getting settings:', error);
      return {};
    }
  }

  // 保存设置
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  }

  // 检测本地Ollama模型
  async detectOllamaModels() {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5秒超时
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.models && Array.isArray(data.models)) {
        return data.models.map(model => ({
          name: model.name,
          size: this.formatBytes(model.size || 0),
          modified_at: model.modified_at
        }));
      }
      
      return [];
    } catch (error) {
      console.error('检测Ollama模型失败:', error);
      throw new Error('无法连接到Ollama服务，请确保Ollama正在运行并监听11434端口');
    }
  }

  // 格式化字节大小
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// 翻译服务类
class TranslationService {
  constructor() {
    // 微软翻译服务不需要endpoint，ollama使用本地endpoint
    this.ollamaEndpoint = 'http://localhost:11434/api/generate';
  }

  // 翻译文本
  async translate(text, settings) {
    if (!text.trim()) {
      throw new Error('翻译文本不能为空');
    }

    // 微软翻译服务不需要API密钥
    if (settings.aiModel !== 'microsoft-translate' && !settings.apiKey) {
      throw new Error('请先配置API密钥');
    }

    try {
      const sourceLang = settings.sourceLang === 'auto' ? '自动检测' : this.getLanguageName(settings.sourceLang);
      const targetLang = this.getLanguageName(settings.targetLang);

      let translation;

      if (settings.aiModel === 'microsoft-translate') {
        translation = await this.translateWithMicrosoft(text, settings.sourceLang, settings.targetLang, settings);
      } else if (settings.aiModel === 'ollama') {
        translation = await this.translateWithOllama(text, sourceLang, targetLang, settings);
      } else {
        throw new Error('不支持的翻译模型');
      }

      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`翻译失败: ${error.message}`);
    }
  }

  // 使用微软翻译服务
  async translateWithMicrosoft(text, sourceLang, targetLang, settings) {
    try {
      // 构建微软翻译API URL
      const from = sourceLang === 'auto' ? '' : sourceLang;
      const to = targetLang;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Microsoft Translate API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData) {
        return data.responseData.translatedText;
      } else {
        throw new Error('翻译服务返回无效响应');
      }
    } catch (error) {
      console.error('Microsoft translation error:', error);
      throw new Error(`微软翻译服务失败: ${error.message}`);
    }
  }

  // 使用Ollama翻译
  async translateWithOllama(text, sourceLang, targetLang, settings) {
    if (!settings.ollamaModel) {
      throw new Error('请先选择Ollama模型');
    }

    try {
      const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果，不要包含任何解释：

${text}`;

      const response = await fetch(this.ollamaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.ollamaModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            top_k: 40
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response?.trim() || '翻译失败';
    } catch (error) {
      console.error('Ollama translation error:', error);
      throw new Error(`Ollama翻译失败: ${error.message}`);
    }
  }

  // 测试API连接
  async testAPI(settings) {
    try {
      const testText = 'Hello, world!';
      const translation = await this.translate(testText, settings);
      
      if (translation && translation !== testText) {
        return { success: true, message: 'API连接成功' };
      } else {
        return { success: false, error: 'API返回无效响应' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 获取语言名称
  getLanguageName(code) {
    const languages = {
      'auto': '自动检测',
      'zh': '中文',
      'en': '英语',
      'ja': '日语',
      'ko': '韩语',
      'fr': '法语',
      'de': '德语',
      'es': '西班牙语',
      'ru': '俄语',
      'it': '意大利语',
      'pt': '葡萄牙语',
      'ar': '阿拉伯语'
    };
    
    return languages[code] || code;
  }
}

// 初始化后台服务
const backgroundService = new BackgroundService();