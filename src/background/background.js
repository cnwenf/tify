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
          const translation = await this.translationService.translate(
            message.text,
            message.settings
          );
          sendResponse({ success: true, translation });
          break;

        case 'testAPI':
          const testResult = await this.translationService.testAPI(message.settings);
          sendResponse(testResult);
          break;

        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ success: true, settings });
          break;

        case 'saveSettings':
          await this.saveSettings(message.settings);
          sendResponse({ success: true });
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
      console.error('Error saving settings:', error);
      throw error;
    }
  }
}

// 翻译服务类
class TranslationService {
  constructor() {
    this.apiEndpoints = {
      'openai-gpt4': 'https://api.openai.com/v1/chat/completions',
      'openai-gpt35': 'https://api.openai.com/v1/chat/completions',
      'claude-3': 'https://api.anthropic.com/v1/messages',
      'gemini-pro': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      'qwen3': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
    };
  }

  // 翻译文本
  async translate(text, settings) {
    if (!text.trim()) {
      throw new Error('翻译文本不能为空');
    }

    if (!settings.apiKey) {
      throw new Error('请先配置API密钥');
    }

    try {
      const model = settings.aiModel;
      const sourceLang = settings.sourceLang === 'auto' ? '自动检测' : this.getLanguageName(settings.sourceLang);
      const targetLang = this.getLanguageName(settings.targetLang);

      let translation;

      if (model.startsWith('openai-')) {
        translation = await this.translateWithOpenAI(text, sourceLang, targetLang, settings);
      } else if (model === 'claude-3') {
        translation = await this.translateWithClaude(text, sourceLang, targetLang, settings);
      } else if (model === 'gemini-pro') {
        translation = await this.translateWithGemini(text, sourceLang, targetLang, settings);
      } else if (model === 'qwen3') {
        translation = await this.translateWithQwen(text, sourceLang, targetLang, settings);
      } else {
        translation = await this.translateWithCustom(text, sourceLang, targetLang, settings);
      }

      return translation;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`翻译失败: ${error.message}`);
    }
  }

  // 使用OpenAI翻译
  async translateWithOpenAI(text, sourceLang, targetLang, settings) {
    const endpoint = settings.customEndpoint || this.apiEndpoints[settings.aiModel];
    const model = settings.aiModel === 'openai-gpt4' ? 'gpt-4' : 'gpt-3.5-turbo';

    const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果，不要包含任何解释：

${text}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || '翻译失败';
  }

  // 使用Claude翻译
  async translateWithClaude(text, sourceLang, targetLang, settings) {
    const endpoint = settings.customEndpoint || this.apiEndpoints['claude-3'];

    const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果：

${text}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text?.trim() || '翻译失败';
  }

  // 使用Gemini翻译
  async translateWithGemini(text, sourceLang, targetLang, settings) {
    const endpoint = `${settings.customEndpoint || this.apiEndpoints['gemini-pro']}?key=${settings.apiKey}`;

    const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果：

${text}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.3
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text?.trim() || '翻译失败';
  }

  // 使用阿里云百炼Qwen翻译
  async translateWithQwen(text, sourceLang, targetLang, settings) {
    const endpoint = settings.customEndpoint || this.apiEndpoints['qwen3'];

    const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果，不要包含任何解释：

${text}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen3-235b-a22b-instruct-2507',
        input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          max_tokens: 1000,
          temperature: 0.3,
          top_p: 0.8,
          result_format: 'message'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Qwen API error response:', errorText);
      throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // 根据阿里云百炼的响应格式解析
    if (data.output && data.output.choices && data.output.choices[0]) {
      return data.output.choices[0].message.content.trim() || '翻译失败';
    } else if (data.output && data.output.text) {
      return data.output.text.trim() || '翻译失败';
    } else {
      console.error('Unexpected Qwen API response format:', data);
      throw new Error('Qwen API 返回格式异常');
    }
  }

  // 使用自定义端点翻译
  async translateWithCustom(text, sourceLang, targetLang, settings) {
    if (!settings.customEndpoint) {
      throw new Error('请配置自定义API端点');
    }

    const response = await fetch(settings.customEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        text: text,
        source_lang: sourceLang,
        target_lang: targetLang
      })
    });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.status}`);
    }

    const data = await response.json();
    return data.translation || data.result || '翻译失败';
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