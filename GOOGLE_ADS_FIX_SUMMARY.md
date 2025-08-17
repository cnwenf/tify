# Google Ad Services JavaScript 内容过滤修复

## 问题描述

在使用AI翻译插件翻译Google.com页面时，页面上出现了非预期的Google Ad Services JavaScript代码内容，具体表现为：

```javascript
(function(){var src='https://www.googleadservices.com/pagead/conversion/16521530460/?gad_source\x3d1\x26adview_type\x3d1\x26adview_query_id\x3dCLTb9NekkY8DFccwRAgdc6YRHQ';(function(){var a=new Image;a.src=src;a.setAttribute("attributionsrc","");}).call(this);})();

(function () {var src = 'https://www.google.com/pagead/1p-conversion/16521530460/?gad_source\ x3d1\ x26adview_type\ x3d4\ x26adview_query_id\ x3dCLTb9NekkY8DFccwRAgdc6YRHQ'; (function () {var a = new Image; a.src = src; a.setAttribute ("attributionsrc", "");}) .call (this);}) ();
```

这些JavaScript代码被插件误认为是可翻译的文本内容，导致出现在翻译结果中。

## 根本原因分析

1. **内容提取逻辑不完善**：插件的内容提取策略没有充分过滤JavaScript代码
2. **排除选择器不足**：缺少对Google Ad Services相关元素的专门排除
3. **文本内容检测缺失**：没有检测文本内容是否为JavaScript代码的机制

## 解决方案

### 1. 增强排除选择器

在 `src/content/content.js` 的 `getTranslatableElementsAdvanced()` 方法中，增加了Google Ad Services相关的排除选择器：

```javascript
const excludeSelectors = [
  // ... 原有选择器
  // Google Ad Services 相关选择器
  '[data-ad-client]', '[data-ad-slot]', '.adsbygoogle',
  'ins[class*="adsbygoogle"]', '[id*="google_ads"]', '[class*="google-ads"]'
];
```

### 2. 添加JavaScript内容检测

新增了 `isJavaScriptContent()` 方法，用于智能识别JavaScript代码：

```javascript
isJavaScriptContent(text) {
  // 检查Google Ad Services相关特征
  const googleAdPatterns = [
    /googleadservices\.com/i,
    /pagead\/conversion/i,
    /gad_source/i,
    /adview_type/i,
    /adview_query_id/i,
    /attributionsrc/i,
    /new\s+Image\s*\(/i,
    /\.setAttribute\s*\(/i
  ];
  
  // 检查JavaScript代码特征
  const jsPatterns = [
    /function\s*\(/i,
    /\(\s*function\s*\(/i,
    /var\s+\w+\s*=/i,
    /\.call\s*\(/i,
    /\.src\s*=/i,
    // ... 更多模式
  ];
  
  // 综合判断逻辑
  // ...
}
```

### 3. 强化元素过滤

添加了对包含script标签的元素的检查：

```javascript
// 检查元素是否包含script标签或其他不应翻译的内容
if (el.querySelector('script, style, noscript')) return false;
```

### 4. 集成到内容提取流程

在内容提取的过滤流程中集成JavaScript检测：

```javascript
// 检查是否为JavaScript代码内容
if (this.isJavaScriptContent(text)) return false;
```

## 检测机制详解

### Google Ad Services 特征检测

- **域名模式**：`googleadservices.com`, `pagead/conversion`
- **参数模式**：`gad_source`, `adview_type`, `adview_query_id`
- **属性模式**：`attributionsrc`
- **API调用模式**：`new Image`, `setAttribute`

### JavaScript 代码模式检测

- **函数声明**：`function(`, `(function(`
- **变量赋值**：`var xxx =`
- **方法调用**：`.call(`, `.src =`
- **函数结构**：`(){...}()`
- **关键字密度**：检查JavaScript关键字出现频率

### 代码特征分析

- **特殊字符比例**：分析 `{}();=` 等字符的密度
- **压缩代码识别**：识别压缩后的JavaScript代码
- **函数调用结构**：识别IIFE（立即执行函数表达式）模式

## 测试验证

创建了 `test_js_detection.html` 测试文件，包含以下测试用例：

1. ✅ Google Ad Services脚本（应被过滤）
2. ✅ 另一个Google Ad Services脚本（应被过滤）
3. ✅ 普通英文文本（不应被过滤）
4. ✅ 中文文本（不应被过滤）
5. ✅ 通用JavaScript函数（应被过滤）
6. ✅ 短文本（不应被过滤）

## 影响范围

### 正面影响
- 彻底解决Google.com页面翻译时出现JavaScript代码的问题
- 提高了整体翻译质量和用户体验
- 增强了对各种JavaScript代码的识别能力
- 减少了不相关内容的翻译请求，提高效率

### 兼容性
- 向后兼容，不影响现有翻译功能
- 对正常文本内容的翻译不产生影响
- 适用于所有支持的AI翻译模型

## 部署建议

1. **测试验证**：在Google.com等广告密集的网站上测试
2. **监控观察**：观察是否有误过滤正常内容的情况
3. **用户反馈**：收集用户反馈，持续优化检测规则

## 未来优化方向

1. **机器学习**：考虑使用ML模型进行更智能的内容分类
2. **规则扩展**：根据用户反馈扩展更多广告网络的过滤规则
3. **性能优化**：优化检测算法的性能，减少计算开销
4. **自定义配置**：允许用户自定义过滤规则

## 版本信息

- **修复版本**：v2.0.1
- **修复日期**：2024年当前日期
- **影响文件**：`src/content/content.js`
- **测试文件**：`test_js_detection.html`

---

此修复彻底解决了Google Ad Services JavaScript代码在翻译时出现的问题，提升了插件的整体质量和用户体验。