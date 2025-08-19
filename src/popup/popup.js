// popup.js - 弹出窗口逻辑

class PopupController {
  constructor() {
    this.elements = {};
    this.settings = {};
    this.performanceData = {
      speed: 0,
      successRate: 100
    };
    this.init();
  }

  // 初始化
  async init() {
    this.initElements();
    await this.loadSettings();
    await this.loadModelList();
    this.bindEvents();
    this.updateUI();
    this.updateUsageStats();
    this.startPerformanceMonitoring();
  }

  // 初始化DOM元素
  initElements() {
    this.elements = {
      aiModel: document.getElementById('aiModel'),
      ollamaModel: document.getElementById('ollamaModel'),
      ollamaModelSection: document.getElementById('ollamaModelSection'),
      refreshOllamaModels: document.getElementById('refreshOllamaModels'),
      modelInfo: document.getElementById('modelInfo'),
      apiKeySection: document.getElementById('apiKeySection'),
      apiKeyHelp: document.getElementById('apiKeyHelp'),
      customEndpointSection: document.getElementById('customEndpointSection'),
      sourceLang: document.getElementById('sourceLang'),
      targetLang: document.getElementById('targetLang'),
      translateMode: document.getElementsByName('translateMode'),
      translatePageBtn: document.getElementById('translatePageBtn'),
      clearTranslationBtn: document.getElementById('clearTranslationBtn'),
      apiKey: document.getElementById('apiKey'),
      customEndpoint: document.getElementById('customEndpoint'),
      testApiBtn: document.getElementById('testApiBtn'),
      toggleApiKey: document.getElementById('toggleApiKey'),
      statusIndicator: document.getElementById('statusIndicator'),
      usageCount: document.getElementById('usageCount'),
      concurrencyLimit: document.getElementById('concurrencyLimit'),
      autoTranslate: document.getElementById('autoTranslate'),
      showFloatButton: document.getElementById('showFloatButton'),
      showSelectionButton: document.getElementById('showSelectionButton'),
      performanceInfo: document.getElementById('performanceInfo'),
      translationSpeed: document.getElementById('translationSpeed'),
      successRate: document.getElementById('successRate'),
      settingsLink: document.getElementById('settingsLink'),
      helpLink: document.getElementById('helpLink'),
      feedbackLink: document.getElementById('feedbackLink')
    };
  }

  // 加载设置
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'aiModel',
        'ollamaModel',
        'sourceLang',
        'targetLang',
        'translateMode',
        'apiKey',
        'customEndpoint',
        'usageCount',
        'concurrencyLimit',
        'autoTranslate',
        'showFloatButton',
        'showSelectionButton',
        'performanceData'
      ]);

      this.settings = {
        translateEnabled: true, // 默认启用AI翻译
        aiModel: result.aiModel || 'microsoft-translator',
        ollamaModel: result.ollamaModel || '',
        sourceLang: result.sourceLang || 'auto',
        targetLang: result.targetLang || 'zh',
        translateMode: result.translateMode || 'immersive-bilingual',
        apiKey: result.apiKey || '',
        customEndpoint: result.customEndpoint || '',
        usageCount: result.usageCount || 0,
        concurrencyLimit: result.concurrencyLimit || 5,
        autoTranslate: result.autoTranslate || false,
        showFloatButton: result.showFloatButton !== undefined ? result.showFloatButton : true,
        showSelectionButton: result.showSelectionButton !== undefined ? result.showSelectionButton : false
      };

      // 加载性能数据
      if (result.performanceData) {
        this.performanceData = { ...this.performanceData, ...result.performanceData };
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 保存设置
  async saveSettings() {
    try {
      const dataToSave = {
        ...this.settings,
        performanceData: this.performanceData
      };
      await chrome.storage.sync.set(dataToSave);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }

  // 绑定事件
  bindEvents() {
    // AI模型选择
    this.elements.aiModel.addEventListener('change', (e) => {
      this.settings.aiModel = e.target.value;
      this.saveSettings();
      this.updateModelInfo(e.target.value);
      this.handleModelSelection(e.target.value);
    });

    // Ollama模型选择
    if (this.elements.ollamaModel) {
      this.elements.ollamaModel.addEventListener('change', (e) => {
        this.settings.ollamaModel = e.target.value;
        this.saveSettings();
      });
    }

    // 刷新Ollama模型列表
    if (this.elements.refreshOllamaModels) {
      this.elements.refreshOllamaModels.addEventListener('click', () => {
        this.loadOllamaModels();
      });
    }

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
          this.updateModePreview(e.target.value);
        }
      });
    });

    // 并发限制
    this.elements.concurrencyLimit.addEventListener('change', (e) => {
      this.settings.concurrencyLimit = parseInt(e.target.value);
      this.saveSettings();
    });

    // 自动翻译
    this.elements.autoTranslate.addEventListener('change', (e) => {
      this.settings.autoTranslate = e.target.checked;
      this.saveSettings();
    });

    // 悬浮按钮显示设置
    this.elements.showFloatButton.addEventListener('change', (e) => {
      this.settings.showFloatButton = e.target.checked;
      this.saveSettings();
      // 通知content script更新悬浮按钮状态
      this.updateFloatButtonVisibility(e.target.checked);
    });

    // 划词翻译按钮显示设置
    this.elements.showSelectionButton.addEventListener('change', (e) => {
      this.settings.showSelectionButton = e.target.checked;
      this.saveSettings();
      // 通知content script更新划词翻译按钮状态
      this.updateSelectionButtonVisibility(e.target.checked);
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

    // 切换API Key显示/隐藏
    this.elements.toggleApiKey.addEventListener('click', () => {
      this.togglePasswordVisibility();
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

    // 底部链接
    this.elements.settingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openAdvancedSettings();
    });

    this.elements.helpLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    this.elements.feedbackLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });

    // 键盘快捷键支持
    document.addEventListener('keydown', (e) => {
      if (e.altKey) {
        switch (e.key) {
          case 't':
          case 'T':
            e.preventDefault();
            this.translateCurrentPage();
            break;
          case 'r':
          case 'R':
            e.preventDefault();
            this.clearTranslation();
            break;
          case 's':
          case 'S':
            e.preventDefault();
            // 切换翻译状态 - 这个功能可能需要实现
            break;
        }
      }
    });
  }

  // 更新UI
  updateUI() {
    this.elements.aiModel.value = this.settings.aiModel;
    this.elements.sourceLang.value = this.settings.sourceLang;
    this.elements.targetLang.value = this.settings.targetLang;
    this.elements.apiKey.value = this.settings.apiKey;
    this.elements.customEndpoint.value = this.settings.customEndpoint;
    this.elements.concurrencyLimit.value = this.settings.concurrencyLimit;
    this.elements.autoTranslate.checked = this.settings.autoTranslate;
    this.elements.showFloatButton.checked = this.settings.showFloatButton;
    this.elements.showSelectionButton.checked = this.settings.showSelectionButton;

    // 设置Ollama模型
    if (this.elements.ollamaModel) {
      this.elements.ollamaModel.value = this.settings.ollamaModel;
    }

    // 设置翻译模式
    this.elements.translateMode.forEach(radio => {
      radio.checked = radio.value === this.settings.translateMode;
    });

    this.updateStatus();
    this.updateModelInfo(this.settings.aiModel);
    this.handleModelSelection(this.settings.aiModel);
    this.updateModePreview(this.settings.translateMode);
    this.updatePerformanceDisplay();
    
    // 初始化时同步设置到content script
    this.syncSettingsToContentScript();
  }

  // 更新悬浮按钮显示状态
  async updateFloatButtonVisibility(show) {
    try {
      // 获取当前活跃的标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        // 发送消息给content script
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateFloatButton',
          show: show
        });
      }
    } catch (error) {
      console.error('更新悬浮按钮状态失败:', error);
    }
  }

  async updateSelectionButtonVisibility(show) {
    try {
      // 获取当前活跃的标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        // 发送消息给content script
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateSelectionButton',
          show: show
        });
      }
    } catch (error) {
      console.error('更新划词翻译按钮状态失败:', error);
    }
  }

  // 同步设置到content script
  async syncSettingsToContentScript() {
    try {
      // 获取当前活跃的标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        // 同步悬浮按钮设置
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateFloatButton',
          show: this.settings.showFloatButton
        });
        
        // 同步划词翻译按钮设置
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateSelectionButton',
          show: this.settings.showSelectionButton
        });
      }
    } catch (error) {
      console.error('同步设置到content script失败:', error);
    }
  }

  // 更新状态指示器
  updateStatus() {
    const statusDot = this.elements.statusIndicator.querySelector('.status-dot');
    const statusText = this.elements.statusIndicator.querySelector('.status-text');

    // AI翻译始终启用
    statusDot.style.background = 'linear-gradient(45deg, #10b981, #059669)';
    statusDot.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
    statusText.textContent = '已启用';
    statusText.style.color = '#10b981';
  }

  // 更新模型信息
  updateModelInfo(model) {
    // 可以在这里添加针对不同模型的特殊提示
    const modelTips = {
      'openai-gpt4': '🧠 最强理解能力，适合复杂文本',
      'openai-gpt35': '⚡ 快速稳定，日常使用推荐',
      'claude-3': '🎨 创意表达优秀，文学翻译佳',
      'gemini-pro': '🌍 多语言支持强，小语种优化',
      'qwen3': '🇨🇳 中文理解深度，国产优选',
      'custom': '🔧 自定义配置，请确保端点正确'
    };

    // 这里可以显示模型提示，暂时保留接口
    console.log('当前模型提示:', modelTips[model] || '');
  }

  // 更新模式预览
  updateModePreview(mode) {
    // 添加选中模式的视觉反馈
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio.value === mode) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // 切换密码显示/隐藏
  togglePasswordVisibility() {
    const apiKeyInput = this.elements.apiKey;
    const toggleBtn = this.elements.toggleApiKey;
    
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleBtn.textContent = '🙈';
      toggleBtn.title = '隐藏密钥';
    } else {
      apiKeyInput.type = 'password';
      toggleBtn.textContent = '👁️';
      toggleBtn.title = '显示密钥';
    }
  }

  // 更新使用统计
  updateUsageStats() {
    this.elements.usageCount.textContent = `今日翻译: ${this.settings.usageCount} 次`;
  }

  // 开始性能监控
  startPerformanceMonitoring() {
    // 如果有API密钥，显示性能信息
    if (this.settings.apiKey) {
      this.elements.performanceInfo.style.display = 'block';
    }
  }

  // 更新性能显示
  updatePerformanceDisplay() {
    if (this.elements.translationSpeed) {
      this.elements.translationSpeed.textContent = `${this.performanceData.speed.toFixed(1)} 段/秒`;
    }
    if (this.elements.successRate) {
      this.elements.successRate.textContent = `${this.performanceData.successRate.toFixed(1)}%`;
    }
  }

  // 翻译当前页面
  async translateCurrentPage() {
    try {
      // 检查API密钥 (Microsoft Translator 和 Ollama 不需要)
      if (!this.settings.apiKey && 
          this.settings.aiModel !== 'microsoft-translator' && 
          this.settings.aiModel !== 'ollama') {
        this.showNotification('请先配置API密钥', 'warning');
        return;
      }

      this.setButtonLoading(this.elements.translatePageBtn, true);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }

      // 记录开始时间用于性能统计
      const startTime = Date.now();

      await chrome.tabs.sendMessage(tab.id, {
        action: 'translatePage',
        settings: this.settings
      });

      // 增加使用计数
      this.settings.usageCount++;
      await this.saveSettings();
      this.updateUsageStats();

      // 更新性能数据
      const duration = Date.now() - startTime;
      this.updatePerformanceData(duration, true);

      this.showNotification('页面翻译已开始，正在智能分段处理...', 'success');
    } catch (error) {
      console.error('翻译页面失败:', error);
      this.updatePerformanceData(0, false);
      this.showNotification(`翻译失败: ${error.message}`, 'error');
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
    // Microsoft Translator 和 Ollama 不需要API Key
    if (!this.settings.apiKey && 
        this.settings.aiModel !== 'microsoft-translator' && 
        this.settings.aiModel !== 'ollama') {
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
        this.showNotification('🎉 API连接成功，可以开始翻译！', 'success');
        this.elements.performanceInfo.style.display = 'block';
      } else {
        this.showNotification(response.error || 'API连接失败', 'error');
      }
    } catch (error) {
      console.error('测试API失败:', error);
      this.showNotification('API测试失败，请检查网络连接', 'error');
    } finally {
      this.setButtonLoading(this.elements.testApiBtn, false);
    }
  }

  // 更新性能数据
  updatePerformanceData(duration, success) {
    if (success && duration > 0) {
      // 假设平均每次翻译处理10个段落
      const estimatedSegments = 10;
      const speed = estimatedSegments / (duration / 1000);
      this.performanceData.speed = (this.performanceData.speed + speed) / 2;
    }
    
    // 更新成功率
    const currentRate = this.performanceData.successRate;
    const newRate = success ? Math.min(100, currentRate + 1) : Math.max(0, currentRate - 5);
    this.performanceData.successRate = newRate;
    
    this.updatePerformanceDisplay();
    this.saveSettings();
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

  // 打开高级设置
  openAdvancedSettings() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/popup/popup.html') + '?advanced=true'
    });
  }

  // 打开帮助页面
  openHelp() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/welcome/welcome.html') + '?tab=help'
    });
  }

  // 显示反馈页面
  openFeedback() {
    const version = chrome.runtime.getManifest().version;
    chrome.tabs.create({
      url: `https://forms.office.com/r/YourFeedbackForm?version=${version}`
    });
  }

  // 加载模型列表
  async loadModelList() {
    try {
      const modelSelect = this.elements.aiModel;
      modelSelect.innerHTML = '<option value="">加载中...</option>';

      // 定义所有可用的AI模型
      const models = [
        { value: 'microsoft-translator', name: '微软翻译', icon: '🌐', description: '快速准确，支持多语言' },
        { value: 'ollama', name: 'Ollama', icon: '🦙', description: '本地AI模型，隐私保护' },
        { value: 'openai-gpt4', name: 'OpenAI GPT-4', icon: '🧠', description: '最强理解能力，适合复杂文本' },
        { value: 'openai-gpt35', name: 'OpenAI GPT-3.5', icon: '⚡', description: '快速稳定，日常使用推荐' },
        { value: 'claude-3', name: 'Claude 3', icon: '🎨', description: '创意表达优秀，文学翻译佳' },
        { value: 'gemini-pro', name: 'Gemini Pro', icon: '🌍', description: '多语言支持强，小语种优化' },
        { value: 'qwen3', name: '阿里云百炼 Qwen3', icon: '🇨🇳', description: '中文理解深度，国产优选' },
        { value: 'custom', name: '自定义模型', icon: '🔧', description: '自定义配置，请确保端点正确' }
      ];

      // 清空并重新填充模型选项
      modelSelect.innerHTML = '';
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = `${model.icon} ${model.name}`;
        option.setAttribute('data-description', model.description);
        modelSelect.appendChild(option);
      });

      // 设置当前选中的模型
      modelSelect.value = this.settings.aiModel;

      // 加载Ollama模型（如果选择了Ollama）
      if (this.settings.aiModel === 'ollama') {
        await this.loadOllamaModels();
      }

    } catch (error) {
      console.error('加载模型列表失败:', error);
      this.showModelInfo('加载模型列表失败', 'error');
    }
  }

  // 处理模型选择
  handleModelSelection(modelValue) {
    const ollamaSection = this.elements.ollamaModelSection;
    const apiKeySection = this.elements.apiKeySection;
    const customEndpointSection = this.elements.customEndpointSection;
    const apiKeyHelp = this.elements.apiKeyHelp;
    
    // 定义需要API Key的服务
    const servicesNeedingApiKey = ['openai-gpt4', 'openai-gpt35', 'claude-3', 'gemini-pro', 'qwen3', 'custom'];
    
    // 根据选择的服务显示/隐藏相应的配置
    if (modelValue === 'ollama') {
      ollamaSection.style.display = 'block';
      apiKeySection.style.display = 'none';
      customEndpointSection.style.display = 'none';
      this.loadOllamaModels();
    } else if (servicesNeedingApiKey.includes(modelValue)) {
      ollamaSection.style.display = 'none';
      apiKeySection.style.display = 'block';
      customEndpointSection.style.display = 'block';
      
      // 根据服务类型设置API Key帮助文本
      const helpTexts = {
        'openai-gpt4': '请输入 OpenAI API Key，支持 GPT-4 模型',
        'openai-gpt35': '请输入 OpenAI API Key，支持 GPT-3.5-turbo 模型',
        'claude-3': '请输入 Anthropic API Key，支持 Claude-3 模型',
        'gemini-pro': '请输入 Google AI API Key，支持 Gemini Pro 模型',
        'qwen3': '请输入阿里云百炼 API Key，支持通义千问模型',
        'custom': '请输入自定义服务的 API Key'
      };
      apiKeyHelp.textContent = helpTexts[modelValue] || '请输入对应服务的API密钥';
    } else {
      // microsoft-translator 等不需要API Key的服务
      ollamaSection.style.display = 'none';
      apiKeySection.style.display = 'none';
      customEndpointSection.style.display = 'none';
    }

    // 显示模型信息
    const selectedOption = this.elements.aiModel.querySelector(`option[value="${modelValue}"]`);
    if (selectedOption) {
      const description = selectedOption.getAttribute('data-description');
      this.showModelInfo(description, 'success');
    }
  }

  // 加载Ollama模型列表
  async loadOllamaModels() {
    try {
      const ollamaSelect = this.elements.ollamaModel;
      ollamaSelect.innerHTML = '<option value="">检测本地模型...</option>';

      // 尝试连接Ollama API
      const response = await fetch('http://localhost:11434/api/tags');
      
      if (!response.ok) {
        throw new Error('无法连接到Ollama服务');
      }

      const data = await response.json();
      
      if (!data.models || data.models.length === 0) {
        ollamaSelect.innerHTML = '<option value="">未发现本地模型</option>';
        this.showModelInfo('未发现本地Ollama模型，请先下载模型', 'error');
        return;
      }

      // 填充模型选项
      ollamaSelect.innerHTML = '';
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        ollamaSelect.appendChild(option);
      });

      // 设置当前选中的模型
      ollamaSelect.value = this.settings.ollamaModel;
      
      this.showModelInfo(`发现 ${data.models.length} 个本地模型`, 'success');

    } catch (error) {
      console.error('加载Ollama模型失败:', error);
      this.elements.ollamaModel.innerHTML = '<option value="">连接失败</option>';
      this.showModelInfo('无法连接到Ollama服务，请确保Ollama已启动', 'error');
    }
  }

  // 显示模型信息
  showModelInfo(message, type = 'info') {
    const modelInfo = this.elements.modelInfo;
    modelInfo.textContent = message;
    modelInfo.className = `model-info ${type}`;
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
      
      // 添加加载动画
      const icon = button.querySelector('.btn-icon');
      if (icon) {
        icon.style.animation = 'spin 1s linear infinite';
      }
    } else {
      button.classList.remove('loading');
      button.disabled = false;
      button.style.opacity = '1';
      
      // 移除加载动画
      const icon = button.querySelector('.btn-icon');
      if (icon) {
        icon.style.animation = '';
      }
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
      borderRadius: '8px',
      color: 'white',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: '10000',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease',
      maxWidth: '300px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      backdropFilter: 'blur(10px)'
    });

    // 根据类型设置背景色
    const colors = {
      success: 'linear-gradient(135deg, #10b981, #059669)',
      error: 'linear-gradient(135deg, #ef4444, #dc2626)',
      warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
      info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
    };
    
    notification.style.background = colors[type] || colors.info;

    document.body.appendChild(notification);

    // 动画显示
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // 根据类型决定显示时长
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, duration);
  }
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});

// 处理来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const controller = window.popupController;
  if (!controller) return;

  switch (message.action) {
    case 'updateUsageCount':
      controller.settings.usageCount = message.count;
      controller.updateUsageStats();
      break;
    
    case 'updatePerformance':
      controller.updatePerformanceData(message.duration, message.success);
      break;
    
    case 'translationProgress':
      // 可以在这里显示翻译进度
      console.log('翻译进度:', message.progress);
      break;
  }
});

// 添加CSS动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .mode-card.selected {
    border: 2px solid #4f46e5;
    background: linear-gradient(120deg, rgba(79, 70, 229, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%);
    transform: scale(1.02);
  }
  
  .loading {
    pointer-events: none;
  }
`;
document.head.appendChild(style);