# Chrome 应用商店发布指南

## 📦 发布包准备

✅ **构建完成**
- 生产发布包: `dist/ai-language-translator-v1.0.0-store.zip` (22KB)
- 开发测试包: `dist/ai-language-translator-v1.0.0-dev.zip` (22KB) 
- 开发文件夹: `dist/extension-dev/`

## 🚀 Chrome 应用商店发布步骤

### 1. 准备开发者账户

1. **访问 Chrome 开发者控制台**
   - 网址: https://chrome.google.com/webstore/devconsole
   - 需要 Google 账户登录

2. **注册开发者账户**
   - 一次性注册费: $5 USD
   - 填写开发者信息
   - 验证身份信息

### 2. 创建应用商店条目

1. **点击 "新增项目"**
2. **上传 ZIP 文件**
   - 选择: `dist/ai-language-translator-v1.0.0-store.zip`
   - 等待上传和基础验证完成

3. **填写应用商店信息**

#### 基本信息
- **应用名称**: AI Language Translator
- **简短描述**: Intelligent bilingual webpage translation powered by AI LLM
- **详细描述**: (见下方详细描述模板)
- **分类**: 生产力工具
- **语言**: 英语 (主要) + 中文 (可选)

#### 详细描述模板
```
🌐 AI Language Translator - 智能网页翻译助手

Transform any webpage into your preferred language with the power of AI! Our extension supports multiple leading AI models including OpenAI GPT, Claude, and Google Gemini.

✨ KEY FEATURES:
• 🤖 Multiple AI Models: GPT-4, GPT-3.5, Claude 3, Gemini Pro
• 🌍 100+ Languages: Translate between any language pair
• 🎯 Smart Translation: Context-aware, natural translations
• 💫 One-Click Translation: Translate entire pages instantly
• 🎨 Bilingual Display: Side-by-side or replacement modes
• ⚡ Text Selection: Translate any selected text
• ⌨️ Keyboard Shortcuts: Alt+A (toggle) / Alt+W (translate page)
• 🎪 Floating Button: Quick access translation button
• 🔧 Customizable: Flexible language and display settings

🚀 HOW TO USE:
1. Install the extension
2. Click the extension icon
3. Choose your AI model and enter API key
4. Select source and target languages
5. Start translating any webpage!

🔒 PRIVACY & SECURITY:
• All API keys stored locally
• No data collection or tracking
• Secure communication with AI providers
• Full user control over translations

🎯 PERFECT FOR:
• International students and researchers
• Business professionals
• Language learners
• Content creators
• Anyone reading foreign websites

Transform your browsing experience with AI-powered translation today!
```

#### 图标和截图
1. **图标文件**: 
   - 已包含在扩展包中 (128x128px)
   - 确保图标清晰、专业

2. **截图要求** (需要手动创建):
   - 至少 1 张，最多 5 张
   - 尺寸: 1280x800 或 640x400
   - 格式: JPG, PNG, 或 GIF
   - 文件大小: < 16MB

**建议截图内容**:
   - 扩展弹窗界面
   - 网页翻译效果对比
   - 配置设置界面
   - 多语言翻译示例

#### 隐私政策
**如果扩展收集用户数据，需要提供隐私政策链接**
- 本扩展不收集用户数据
- 可以在隐私实践部分说明 "不收集数据"

### 3. 权限说明

在商店列表中清楚说明为什么需要这些权限:

- **activeTab**: 访问当前标签页进行翻译
- **storage**: 保存用户配置和API密钥
- **scripting**: 在网页中注入翻译功能
- **contextMenus**: 提供右键菜单翻译选项
- **host_permissions**: 在所有网站上工作

### 4. 审核要点

#### Chrome 商店政策合规
- ✅ 功能明确：专注于翻译功能
- ✅ 用户价值：提供实用的翻译服务
- ✅ 权限合理：只请求必要权限
- ✅ 质量保证：无明显 bug，UI 友好

#### 常见审核问题
1. **权限过度**: 确保只请求必要权限
2. **功能不明确**: 在描述中清楚说明功能
3. **质量问题**: 确保扩展稳定运行
4. **误导信息**: 避免夸大或虚假宣传

### 5. 提交流程

1. **完成所有必需信息**
2. **点击 "提交审核"**
3. **等待审核结果** (通常 1-3 个工作日)
4. **根据反馈修改** (如有需要)

## 📋 发布前检查清单

- [ ] 扩展功能测试完毕
- [ ] manifest.json 信息准确
- [ ] 所有必需文件已包含
- [ ] 准备好商店截图
- [ ] 编写清楚的应用描述
- [ ] 开发者账户已注册
- [ ] 理解并遵守 Chrome 商店政策

## 🔄 版本更新流程

后续版本更新时:
1. 修改 `manifest.json` 中的版本号
2. 重新运行构建脚本: `scripts/simple-build.sh`
3. 在开发者控制台上传新的 ZIP 文件
4. 更新版本说明
5. 提交新版本审核

## 📞 支持和反馈

发布后，用户可能会:
- 在商店页面留下评价和评分
- 通过支持邮箱联系问题
- 在 GitHub 仓库提交 Issues

建议:
- 及时回复用户反馈
- 定期更新扩展功能
- 保持良好的用户评分

---

**注意**: Chrome 应用商店政策会定期更新，发布前请查阅最新的开发者政策文档。