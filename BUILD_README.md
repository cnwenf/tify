# AI Language Translator - 构建和发布

## 🛠️ 构建环境要求

- Linux/macOS/Windows (推荐 Linux)
- Node.js 14+ (可选，用于高级构建)
- Python 3 (用于验证)
- zip 命令行工具
- bash shell

## 🚀 快速构建

### 方法 1: 使用简化构建脚本 (推荐)

```bash
# 给脚本执行权限
chmod +x scripts/simple-build.sh

# 运行构建
scripts/simple-build.sh
```

### 方法 2: 使用 npm 脚本

```bash
# 安装依赖 (仅首次)
npm install

# 构建 Chrome 商店发布包
npm run build:store

# 或者运行标准构建
npm run build
```

## 📦 构建产物

构建完成后，在 `dist/` 目录下会生成：

- `ai-language-translator-v1.0.0-store.zip` - Chrome 应用商店发布包
- `ai-language-translator-v1.0.0-dev.zip` - 开发测试包
- `extension-dev/` - 开发者模式安装文件夹

## 🔍 验证构建

```bash
# 运行扩展验证
npm run validate

# 或直接运行 Python 脚本
python3 validate_extension.py
```

## 📋 Chrome 应用商店发布

1. **准备发布包**: 使用 `dist/ai-language-translator-v1.0.0-store.zip`
2. **访问开发者控制台**: https://chrome.google.com/webstore/devconsole
3. **上传扩展包**: 选择生成的 ZIP 文件
4. **填写商店信息**: 参考 `CHROME_STORE_GUIDE.md`
5. **提交审核**: 等待 1-3 个工作日

## 🧪 本地测试

### 开发者模式安装

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `dist/extension-dev/` 文件夹

### 功能测试

1. 点击扩展图标
2. 配置 AI 模型和 API 密钥
3. 访问任意网页测试翻译功能
4. 检查所有功能是否正常工作

## 🔄 版本更新

1. 修改 `manifest.json` 中的版本号
2. 重新运行构建脚本
3. 上传新的 ZIP 文件到 Chrome 商店
4. 更新版本说明并提交审核

## 📁 文件结构

```
tify/
├── manifest.json              # 扩展清单文件
├── src/                       # 源代码目录
│   ├── popup/                 # 弹窗界面
│   ├── content/              # 内容脚本
│   ├── background/           # 后台脚本
│   ├── assets/               # 资源文件
│   └── welcome/              # 欢迎页面
├── scripts/                   # 构建脚本
│   ├── simple-build.sh       # 简化构建脚本
│   └── build.js             # Node.js 构建脚本
├── dist/                     # 构建产物 (自动生成)
├── package.json              # 项目配置
├── CHROME_STORE_GUIDE.md     # Chrome 商店发布指南
└── BUILD_README.md           # 本文件
```

## ⚠️ 注意事项

1. **API 密钥安全**: 不要在代码中硬编码 API 密钥
2. **权限最小化**: 只请求必要的扩展权限
3. **版本号管理**: 每次发布前更新版本号
4. **测试充分**: 在多个网站上测试翻译功能
5. **遵守政策**: 确保符合 Chrome 应用商店政策

## 🐛 故障排除

### 构建失败

- 检查是否有 zip 命令
- 确保文件权限正确
- 检查 manifest.json 格式

### 验证失败

- 确保所有必需文件存在
- 检查图标文件大小和格式
- 验证 JavaScript 语法

### 上传失败

- 检查 ZIP 文件大小 (< 2MB)
- 确保 manifest.json 格式正确
- 检查权限声明是否合理

## 📞 支持

如遇问题，请检查：
1. 控制台错误信息
2. 扩展验证结果
3. Chrome 商店审核反馈

---

**提示**: 建议在每次发布前先在开发者模式下充分测试。