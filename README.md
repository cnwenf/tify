# 网页翻译图片丢失问题解决方案

## 问题描述

在使用网页翻译功能时，图片元素经常会丢失。这是因为翻译工具会重新组织DOM结构，将原本包含图片的HTML段落包装在翻译结构中，导致图片元素被移除或隐藏。

### 问题示例

**翻译前：**
```html
<p dir="auto">
    <a target="_blank" rel="noopener noreferrer" href="/path/to/image.png">
        <img src="/path/to/image.png" alt="description" style="max-width: 100%;">
    </a>
    <br>
    Examples from M3-Bench...
</p>
```

**翻译后：**
```html
<p dir="auto" data-ai-translated="true">
    <div class="ai-translation-immersive">
        <div class="original-text">Examples from M3-Bench...</div>
        <div class="translated-text">来自M3-Bench的示例...</div>
    </div>
</p>
<!-- 图片丢失！ -->
```

## 解决方案

本解决方案包含三个核心文件：

1. **`image-preservation-fix.js`** - 主要的JavaScript保护机制
2. **`image-preservation.css`** - 配套的CSS样式
3. **`example-usage.html`** - 使用示例和演示

## 核心功能

### 1. 图片元素保护
- 自动识别页面中的所有图片元素
- 为图片添加保护标记和数据备份
- 监听DOM变化，检测图片被移除的情况

### 2. 实时恢复机制
- 使用MutationObserver监听DOM变化
- 检测翻译结构的添加
- 在合适的位置自动恢复丢失的图片

### 3. 智能插入点识别
- 分析翻译后的内容结构
- 根据上下文找到最佳的图片插入位置
- 确保图片在语义上正确的位置显示

## 使用方法

### 方法一：直接引入（推荐）

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="image-preservation.css">
</head>
<body>
    <!-- 你的内容 -->
    
    <script src="image-preservation-fix.js"></script>
</body>
</html>
```

### 方法二：手动初始化

```javascript
// 创建保护管理器实例
const imagePreservation = new ImagePreservationManager();

// 初始化保护机制
imagePreservation.init();

// 如果需要，可以手动触发检查
imagePreservation.checkAndRestoreImages();
```

## 高级配置

### 自定义保护规则

```javascript
const imagePreservation = new ImagePreservationManager();

// 自定义图片选择器
imagePreservation.customImageSelectors = [
    'img[src*="specific-pattern"]',
    '.custom-image-class img'
];

// 自定义插入点识别
imagePreservation.customInsertionRules = [
    { pattern: /特定文本模式/, position: 'before' }
];

imagePreservation.init();
```

### 调试模式

```javascript
// 启用调试模式
document.body.classList.add('debug-image-protection');

// 监听保护事件
window.addEventListener('imageProtected', function(event) {
    console.log('图片已保护:', event.detail);
});

window.addEventListener('imageRestored', function(event) {
    console.log('图片已恢复:', event.detail);
});
```

## 工作原理

### 1. 初始化阶段
```javascript
// 扫描现有图片
preserveExistingImages() {
    const images = document.querySelectorAll('img');
    images.forEach(img => this.protectImageElement(img));
}
```

### 2. 监听阶段
```javascript
// 设置DOM变化监听
setupMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
        // 检测图片被移除
        // 检测翻译结构被添加
        // 触发恢复机制
    });
}
```

### 3. 恢复阶段
```javascript
// 在翻译内容中恢复图片
restoreImagesInTranslatedContent(translatedNode) {
    const insertionPoints = this.findImageInsertionPoints(translatedNode);
    insertionPoints.forEach(point => this.restoreImageAtPoint(point));
}
```

## 兼容性

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+

## 性能优化

1. **延迟加载**: 使用setTimeout避免阻塞主线程
2. **批量处理**: 一次性处理多个图片元素
3. **内存管理**: 自动清理不再需要的数据
4. **事件节流**: 避免过度频繁的DOM操作

## 故障排除

### 图片仍然丢失

1. 检查控制台是否有错误信息
2. 确认CSS文件已正确加载
3. 验证图片URL是否正确
4. 检查是否有其他脚本冲突

### 性能问题

1. 减少检查频率：
```javascript
// 调整检查间隔（默认5秒）
setInterval(() => {
    this.checkAndRestoreImages();
}, 10000); // 改为10秒
```

2. 限制监听范围：
```javascript
// 只监听特定容器
this.observer.observe(document.getElementById('content'), options);
```

## 示例演示

运行 `example-usage.html` 查看完整的演示效果：

1. 打开HTML文件
2. 点击"模拟翻译过程"按钮
3. 观察图片是否成功保护和恢复
4. 使用"切换调试模式"查看保护状态

## 贡献

欢迎提交Issue和Pull Request来改进这个解决方案。

## 许可证

MIT License