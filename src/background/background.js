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
            } else if (error.message.includes('Ollama API 访问被拒绝 (403)')) {
              // Ollama CORS 错误，保持原始详细错误信息
              errorMessage = error.message;
            } else if (error.message.includes('API error: 403')) {
              errorMessage = 'API访问被拒绝，请检查权限和余额';
            } else if (error.message.includes('无法连接到 Ollama 服务')) {
              // Ollama 连接错误，保持原始详细错误信息
              errorMessage = error.message;
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
      
      // 检查API密钥是否配置 (只有 Ollama 不需要)
      if (!settings.apiKey && settings.aiModel !== 'ollama') {
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
      translateEnabled: true, // 默认启用AI翻译
      aiModel: 'microsoft-translator',
      sourceLang: 'auto',
      targetLang: 'zh',
      translateMode: 'immersive-bilingual',
      apiKey: '',
      customEndpoint: '',
      ollamaModel: '',
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
        'ollamaModel',
        'usageCount'
      ]);

      return {
        translateEnabled: result.translateEnabled !== undefined ? result.translateEnabled : true, // 默认启用
        aiModel: result.aiModel || 'openai-gpt35',
        sourceLang: result.sourceLang || 'auto',
        targetLang: result.targetLang || 'zh',
        translateMode: result.translateMode || 'immersive-bilingual',
        apiKey: result.apiKey || '',
        customEndpoint: result.customEndpoint || '',
        ollamaModel: result.ollamaModel || '',
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
      'microsoft-translator': 'https://api.cognitive.microsofttranslator.com/translate',
      'ollama': 'http://localhost:11434/api/generate',
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

    // 只有 Ollama 不需要API密钥
    if (!settings.apiKey && settings.aiModel !== 'ollama') {
      throw new Error('请先配置API密钥');
    }

    try {
      const model = settings.aiModel;
      const sourceLang = settings.sourceLang === 'auto' ? '自动检测' : this.getLanguageName(settings.sourceLang);
      const targetLang = this.getLanguageName(settings.targetLang);

      let translation;

      if (model === 'microsoft-translator') {
        translation = await this.translateWithMicrosoft(text, settings.sourceLang, settings.targetLang, settings);
      } else if (model === 'ollama') {
        translation = await this.translateWithOllama(text, sourceLang, targetLang, settings);
      } else if (model.startsWith('openai-')) {
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
    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Qwen3 翻译尝试 ${attempt + 1}/${maxRetries + 1}`);
        
        const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果，不要包含任何解释：

${text}`;

        const requestBody = {
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
        };

        console.log('Qwen3 请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        console.log('Qwen3 响应状态:', response.status);
        console.log('Qwen3 响应头:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Qwen3 API 错误响应:', errorText);
          
          // 根据状态码判断是否应该重试
          if (response.status === 429) {
            // 频率限制，等待更长时间后重试
            if (attempt < maxRetries) {
              console.log('Qwen3 频率限制，等待5秒后重试...');
              await new Promise(resolve => setTimeout(resolve, 5000));
              continue;
            }
            throw new Error(`Qwen API 调用频率超限: ${response.status} - ${errorText}`);
          } else if (response.status === 401) {
            // 认证错误，不需要重试
            throw new Error(`Qwen API 认证失败，请检查API密钥: ${response.status} - ${errorText}`);
          } else if (response.status === 403) {
            // 权限错误，不需要重试
            throw new Error(`Qwen API 访问被拒绝，请检查权限和余额: ${response.status} - ${errorText}`);
          } else if (response.status >= 500 && attempt < maxRetries) {
            // 服务器错误，可以重试
            console.log('Qwen3 服务器错误，等待3秒后重试...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            continue;
          } else {
            throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
          }
        }

        const data = await response.json();
        console.log('Qwen3 API 响应数据:', JSON.stringify(data, null, 2));
        
        // 根据阿里云百炼的响应格式解析
        if (data.output && data.output.choices && data.output.choices[0]) {
          const translation = data.output.choices[0].message.content.trim();
          if (translation) {
            console.log('Qwen3 翻译成功:', translation);
            return translation;
          } else {
            throw new Error('Qwen API 返回空翻译结果');
          }
        } else if (data.output && data.output.text) {
          const translation = data.output.text.trim();
          if (translation) {
            console.log('Qwen3 翻译成功:', translation);
            return translation;
          } else {
            throw new Error('Qwen API 返回空翻译结果');
          }
        } else if (data.code && data.message) {
          // 处理API错误响应格式
          console.error('Qwen API 错误:', data.code, data.message);
          throw new Error(`Qwen API 错误: ${data.code} - ${data.message}`);
        } else {
          console.error('Qwen3 意外的响应格式:', data);
          throw new Error('Qwen API 返回格式异常');
        }
        
      } catch (error) {
        lastError = error;
        console.error(`Qwen3 翻译尝试 ${attempt + 1} 失败:`, error.message);
        
        // 如果是网络错误且还有重试机会，则继续重试
        if ((error.name === 'TypeError' || error.message.includes('fetch')) && attempt < maxRetries) {
          console.log('Qwen3 网络错误，等待2秒后重试...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // 如果不是可重试的错误，或者已经达到最大重试次数，抛出错误
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    // 所有重试都失败了
    throw new Error(`Qwen3 翻译失败，已重试 ${maxRetries} 次: ${lastError.message}`);
  }

  // 使用微软Bing翻译服务 (官方Microsoft Translator API)
  async translateWithMicrosoft(text, sourceLang, targetLang, settings) {
    // 使用官方Microsoft Translator API
    const endpoint = 'https://api.cognitive.microsofttranslator.com/translate';
    const maxRetries = 3;
    let lastError;
    
    // 检查是否配置了API密钥
    if (!settings.apiKey) {
      throw new Error('请先配置Microsoft Translator API密钥。您可以在Azure门户中创建Translator资源获取密钥。');
    }
    
    // 语言代码映射 (Microsoft Translator API格式)
    const langMap = {
      'auto': null, // 自动检测时不传from参数
      'zh': 'zh-Hans', // 简体中文
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'ru': 'ru',
      'it': 'it',
      'pt': 'pt',
      'ar': 'ar'
    };

    const fromLang = langMap[sourceLang];
    const toLang = langMap[targetLang] || 'zh-Hans';

    // 构建查询参数
    const params = new URLSearchParams({
      'api-version': '3.0',
      'to': toLang
    });
    
    // 如果不是自动检测，添加from参数
    if (fromLang) {
      params.append('from', fromLang);
    }

    // 实现重试机制处理频率限制
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Microsoft Bing Translator 翻译尝试 ${attempt + 1}/${maxRetries + 1}`);
        
        const response = await fetch(`${endpoint}?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': settings.apiKey,
            'User-Agent': 'Chrome-Extension-Translator/2.0'
          },
          body: JSON.stringify([{
            'text': text
          }])
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Microsoft Bing Translator API 错误响应:', errorText);
          
          // 处理频率限制错误 (429)
          if (response.status === 429) {
            if (attempt < maxRetries) {
              console.log('Microsoft Bing Translator 频率限制，等待10秒后重试...');
              await new Promise(resolve => setTimeout(resolve, 10000));
              continue;
            }
            throw new Error(`API调用频率超限，请稍后重试`);
          } else if (response.status === 401) {
            throw new Error(`API密钥无效，请检查Microsoft Translator API密钥配置`);
          } else if (response.status === 403) {
            throw new Error(`API访问被拒绝，请检查Microsoft Translator API权限和余额`);
          } else if (response.status >= 500 && attempt < maxRetries) {
            // 服务器错误，可以重试
            console.log('Microsoft Bing Translator 服务器错误，等待5秒后重试...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          } else {
            throw new Error(`Microsoft Bing Translator API error: ${response.status} - ${errorText}`);
          }
        }

        const data = await response.json();
        console.log('Microsoft Bing Translator API 响应数据:', data);
        
        // 解析Microsoft Translator API v3.0响应格式
        if (data && Array.isArray(data) && data[0] && data[0].translations && data[0].translations[0]) {
          const translation = data[0].translations[0].text;
          if (translation && translation.trim()) {
            console.log('Microsoft Bing Translator 翻译成功:', translation);
            return translation.trim();
          } else {
            throw new Error('Microsoft Translator API返回空翻译结果');
          }
        } else {
          console.error('Microsoft Bing Translator 意外的响应格式:', data);
          throw new Error('Microsoft Translator API返回无效响应格式');
        }
        
      } catch (error) {
        lastError = error;
        console.error(`Microsoft Bing Translator 翻译尝试 ${attempt + 1} 失败:`, error.message);
        
        // 如果是网络错误且还有重试机会，则继续重试
        if ((error.name === 'TypeError' || error.message.includes('fetch')) && attempt < maxRetries) {
          console.log('Microsoft Bing Translator 网络错误，等待3秒后重试...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        
        // 如果不是可重试的错误，或者已经达到最大重试次数，抛出错误
        if (attempt === maxRetries) {
          break;
        }
      }
    }

    // 所有重试都失败了
    throw new Error(`Microsoft Bing Translator 翻译失败，已重试 ${maxRetries} 次: ${lastError.message}`);
  }

  // 使用Ollama翻译
  async translateWithOllama(text, sourceLang, targetLang, settings) {
    const endpoint = settings.customEndpoint || this.apiEndpoints['ollama'];
    const model = settings.ollamaModel || 'llama2';

    const prompt = `请将以下文本从${sourceLang}翻译成${targetLang}，只返回翻译结果，不要包含任何解释：

${text}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Chrome-Extension-Translator/1.0'
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama API 错误响应:', errorText);
        
        if (response.status === 403) {
          throw new Error(`Ollama API 访问被拒绝 (403)。这通常是由于CORS跨域限制导致的。请设置环境变量 OLLAMA_ORIGINS 来允许浏览器扩展访问：
          
Windows: set OLLAMA_ORIGINS=*
Linux/Mac: export OLLAMA_ORIGINS=*
然后重启 Ollama 服务：ollama serve

详细信息: ${errorText}`);
        } else if (response.status === 404) {
          throw new Error(`Ollama 服务未找到 (404)。请确保：
1. Ollama 服务正在运行 (ollama serve)
2. 模型 "${model}" 已安装 (ollama pull ${model})
3. 服务地址正确: ${endpoint}`);
        } else {
          throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      
      if (data && data.response) {
        return data.response.trim();
      }
      
      throw new Error('Ollama返回无效响应格式');
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`无法连接到 Ollama 服务。请检查：
1. Ollama 服务是否正在运行 (ollama serve)
2. 服务地址是否正确: ${endpoint}
3. 防火墙是否阻止了连接

原始错误: ${error.message}`);
      }
      throw error;
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
        let successMessage = 'API连接成功';
        if (settings.aiModel === 'ollama') {
          successMessage = `Ollama API连接成功，模型: ${settings.ollamaModel || 'llama2'}`;
        }
        return { success: true, message: successMessage };
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