# 扩展上下文错误修复说明

## 问题描述

Chrome 扩展在使用过程中可能会遇到 "Extension context invalidated" 错误，这通常发生在以下情况：

1. 扩展被重新加载或更新
2. 扩展被禁用后重新启用
3. 浏览器重启后扩展状态不一致
4. 扩展的 background script 被意外终止

## 修复内容

### 1. 改进错误检测和处理

在 `src/content/content.js` 中：

- 添加了更完善的扩展上下文检查机制
- 实现了自动检测和恢复功能
- 添加了超时处理机制
- 改进了错误日志记录

### 2. 事件监听器管理

- 将所有事件监听器绑定到实例属性，便于清理
- 添加了 `removeEventListeners()` 方法
- 添加了 `cleanup()` 方法用于资源清理
- 在页面卸载时自动清理资源

### 3. 消息通信改进

在 `src/background/background.js` 中：

- 添加了扩展上下文有效性检查
- 改进了错误处理和响应机制
- 增加了更详细的错误日志

### 4. 初始化优化

- 延迟初始化，确保 DOM 已加载
- 添加了初始化失败的错误处理
- 实现了自动重试机制

## 主要修改文件

### src/content/content.js

1. **构造函数改进**：
   ```javascript
   constructor() {
     // 添加扩展检查间隔属性
     this.extensionCheckInterval = null;
     
     // 延迟初始化，确保DOM已加载
     if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', () => {
         this.init();
       });
     } else {
       this.init();
     }
   }
   ```

2. **扩展状态监听器**：
   ```javascript
   setupExtensionStateListener() {
     this.extensionCheckInterval = setInterval(() => {
       if (!chrome.runtime?.id) {
         console.warn('Tidy: 检测到扩展上下文失效，尝试重新初始化');
         this.handleExtensionContextInvalidated();
       }
     }, 30000);
   }
   ```

3. **上下文失效处理**：
   ```javascript
   handleExtensionContextInvalidated() {
     // 清理现有元素和事件监听器
     this.clearTranslation();
     this.hideSelectionButton();
     this.removeEventListeners();
     
     // 停止定期检查
     if (this.extensionCheckInterval) {
       clearInterval(this.extensionCheckInterval);
       this.extensionCheckInterval = null;
     }
     
     // 显示提示并尝试重新初始化
     this.showNotification('扩展上下文已失效，请刷新页面重试', 'warning');
     setTimeout(() => {
       if (chrome.runtime?.id) {
         this.init();
       }
     }, 2000);
   }
   ```

4. **资源清理**：
   ```javascript
   cleanup() {
     this.isTranslating = false;
     this.clearTranslation();
     this.hideSelectionButton();
     this.removeEventListeners();
     
     if (this.extensionCheckInterval) {
       clearInterval(this.extensionCheckInterval);
       this.extensionCheckInterval = null;
     }
     
     if (this.floatButton && this.floatButton.parentNode) {
       this.floatButton.parentNode.removeChild(this.floatButton);
       this.floatButton = null;
     }
   }
   ```

### src/background/background.js

1. **消息监听器改进**：
   ```javascript
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
       return true;
     });
   }
   ```

## 测试方法

1. 使用提供的测试页面 `test_extension_context.html`
2. 在 Chrome 开发者工具中重新加载扩展
3. 观察控制台日志和页面状态
4. 测试翻译功能是否正常工作

## 预防措施

1. **定期检查**：每30秒检查一次扩展上下文状态
2. **自动恢复**：检测到失效时自动尝试重新初始化
3. **用户提示**：显示友好的错误提示信息
4. **资源清理**：确保在页面卸载时清理所有资源

## 注意事项

- 修复后的代码具有更好的容错性
- 自动重试机制可能会在扩展更新时触发
- 建议在扩展更新后刷新相关页面
- 如果问题持续存在，可能需要重新安装扩展

## 兼容性

- 支持 Chrome 88+ 版本
- 兼容 Manifest V3
- 支持所有现代浏览器扩展API
