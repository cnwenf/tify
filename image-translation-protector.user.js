// ==UserScript==
// @name         图片翻译保护器 (Image Translation Protector)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  防止Chrome翻译时图片丢失的用户脚本 / Prevent image loss during Chrome translation
// @author       Assistant
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    // 存储原始图片信息
    let originalImages = new Map();
    let isTranslationActive = false;
    let observer = null;
    let restoredCount = 0;
    
    // 添加控制面板样式
    const style = document.createElement('style');
    style.textContent = `
        #imageProtectorPanel {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 280px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            z-index: 10000;
            display: none;
        }
        
        #imageProtectorPanel.show {
            display: block;
        }
        
        .ip-header {
            background: linear-gradient(135deg, #4285f4, #34a853);
            color: white;
            padding: 12px;
            border-radius: 8px 8px 0 0;
            text-align: center;
            font-weight: bold;
        }
        
        .ip-content {
            padding: 15px;
        }
        
        .ip-status {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 4px 0;
        }
        
        .ip-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 6px;
        }
        
        .ip-indicator.active {
            background: #34a853;
        }
        
        .ip-indicator.inactive {
            background: #ea4335;
        }
        
        .ip-buttons {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        
        .ip-btn {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #f8f9fa;
            cursor: pointer;
            font-size: 11px;
        }
        
        .ip-btn:hover {
            background: #e8eaed;
        }
        
        .ip-btn.primary {
            background: #4285f4;
            color: white;
            border-color: #4285f4;
        }
        
        .ip-btn.primary:hover {
            background: #3367d6;
        }
        
        .ip-toggle {
            position: fixed;
            top: 10px;
            right: 300px;
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 12px;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        
        .ip-toggle:hover {
            background: #3367d6;
        }
    `;
    
    // 检测翻译状态的函数
    function detectTranslation() {
        const translatedElements = document.querySelectorAll('[data-ai-translated="true"], .ai-translation-immersive, [data-gtm-vis-has-fired], [data-gtm-vis-first-on-screen], .VIpgJd-ZVi9od-aZ2wEe-wOHMyf, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf-ti6hGc');
        return translatedElements.length > 0;
    }
    
    // 保存页面中的所有图片信息
    function saveImages() {
        const images = document.querySelectorAll('img');
        
        images.forEach((img, index) => {
            const imgInfo = {
                src: img.src,
                alt: img.alt || '',
                title: img.title || '',
                className: img.className,
                style: img.style.cssText,
                width: img.width,
                height: img.height,
                outerHTML: img.outerHTML
            };
            
            // 检查图片是否在链接内
            const parentLink = img.closest('a');
            if (parentLink) {
                imgInfo.parentLink = {
                    href: parentLink.href,
                    target: parentLink.target,
                    rel: parentLink.rel,
                    className: parentLink.className,
                    outerHTML: parentLink.outerHTML
                };
            }
            
            originalImages.set(`img_${index}`, imgInfo);
        });
        
        console.log(`[图片保护器] 已保存 ${images.length} 张图片信息`);
        updatePanel();
    }
    
    // 恢复丢失的图片
    function restoreImages() {
        if (originalImages.size === 0) return;
        
        console.log('[图片保护器] 开始恢复图片...');
        
        originalImages.forEach((imgInfo, key) => {
            const existingImg = document.querySelector(`img[src="${imgInfo.src}"]`);
            if (existingImg) return;
            
            const translationContainers = document.querySelectorAll('.ai-translation-immersive, [data-ai-translated="true"]');
            
            translationContainers.forEach(container => {
                const originalText = container.getAttribute('data-original-text') || 
                                   container.querySelector('.original-text')?.textContent || '';
                
                if (originalText.includes(imgInfo.alt) || 
                    originalText.includes('image') || 
                    originalText.includes('图') ||
                    originalText.includes('Examples') ||
                    originalText.includes('示例')) {
                    
                    const newImg = document.createElement('img');
                    newImg.src = imgInfo.src;
                    newImg.alt = imgInfo.alt;
                    newImg.title = imgInfo.title;
                    newImg.className = imgInfo.className;
                    newImg.style.cssText = imgInfo.style;
                    
                    if (imgInfo.parentLink) {
                        const newLink = document.createElement('a');
                        newLink.href = imgInfo.parentLink.href;
                        newLink.target = imgInfo.parentLink.target;
                        newLink.rel = imgInfo.parentLink.rel;
                        newLink.className = imgInfo.parentLink.className;
                        newLink.appendChild(newImg);
                        
                        container.parentNode.insertBefore(newLink, container.nextSibling);
                    } else {
                        container.parentNode.insertBefore(newImg, container.nextSibling);
                    }
                    
                    console.log(`[图片保护器] 已恢复图片: ${imgInfo.src}`);
                    restoredCount++;
                }
            });
        });
        
        updatePanel();
    }
    
    // 智能恢复图片
    function smartRestoreImages() {
        if (originalImages.size === 0) return;
        
        console.log('[图片保护器] 开始智能恢复图片...');
        
        const paragraphs = document.querySelectorAll('p, div, section, article');
        
        originalImages.forEach((imgInfo, key) => {
            const existingImg = document.querySelector(`img[src="${imgInfo.src}"]`);
            if (existingImg) return;
            
            paragraphs.forEach(paragraph => {
                const text = paragraph.textContent.toLowerCase();
                
                const keywords = ['example', 'architecture', 'figure', 'image', '示例', '架构', '图', '例子'];
                const hasKeyword = keywords.some(keyword => text.includes(keyword.toLowerCase()));
                
                if (hasKeyword || text.includes(imgInfo.alt.toLowerCase())) {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.cssText = 'text-align: center; margin: 10px 0;';
                    
                    const newImg = document.createElement('img');
                    newImg.src = imgInfo.src;
                    newImg.alt = imgInfo.alt;
                    newImg.title = imgInfo.title;
                    newImg.style.cssText = imgInfo.style || 'max-width: 100%; height: auto;';
                    
                    if (imgInfo.parentLink) {
                        const newLink = document.createElement('a');
                        newLink.href = imgInfo.parentLink.href;
                        newLink.target = imgInfo.parentLink.target || '_blank';
                        newLink.rel = imgInfo.parentLink.rel || 'noopener noreferrer';
                        newLink.appendChild(newImg);
                        imgContainer.appendChild(newLink);
                    } else {
                        imgContainer.appendChild(newImg);
                    }
                    
                    paragraph.parentNode.insertBefore(imgContainer, paragraph.nextSibling);
                    
                    console.log(`[图片保护器] 智能恢复图片: ${imgInfo.src}`);
                    restoredCount++;
                    updatePanel();
                    return;
                }
            });
        });
    }
    
    // 创建控制面板
    function createPanel() {
        // 添加样式
        document.head.appendChild(style);
        
        // 创建切换按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'ip-toggle';
        toggleBtn.textContent = '🖼️ 图片保护';
        toggleBtn.onclick = () => {
            const panel = document.getElementById('imageProtectorPanel');
            panel.classList.toggle('show');
        };
        document.body.appendChild(toggleBtn);
        
        // 创建面板
        const panel = document.createElement('div');
        panel.id = 'imageProtectorPanel';
        panel.innerHTML = `
            <div class="ip-header">
                🖼️ 图片翻译保护器
            </div>
            <div class="ip-content">
                <div class="ip-status">
                    <span><span class="ip-indicator active"></span>保护状态</span>
                    <span>已激活</span>
                </div>
                <div class="ip-status">
                    <span>已保存图片</span>
                    <span id="savedCount">0</span>
                </div>
                <div class="ip-status">
                    <span>已恢复图片</span>
                    <span id="restoredCount">0</span>
                </div>
                <div class="ip-status">
                    <span>翻译状态</span>
                    <span id="translationStatus">未检测到</span>
                </div>
                <div class="ip-buttons">
                    <button class="ip-btn primary" id="manualRestore">手动恢复</button>
                    <button class="ip-btn" id="refreshScan">刷新扫描</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        
        // 绑定按钮事件
        document.getElementById('manualRestore').onclick = () => {
            restoreImages();
            smartRestoreImages();
        };
        
        document.getElementById('refreshScan').onclick = () => {
            restoredCount = 0;
            saveImages();
        };
    }
    
    // 更新面板状态
    function updatePanel() {
        const savedCountEl = document.getElementById('savedCount');
        const restoredCountEl = document.getElementById('restoredCount');
        const translationStatusEl = document.getElementById('translationStatus');
        
        if (savedCountEl) savedCountEl.textContent = originalImages.size;
        if (restoredCountEl) restoredCountEl.textContent = restoredCount;
        if (translationStatusEl) {
            translationStatusEl.textContent = detectTranslation() ? '已检测到' : '未检测到';
        }
    }
    
    // 监听DOM变化
    function startObserving() {
        if (observer) observer.disconnect();
        
        observer = new MutationObserver((mutations) => {
            let shouldRestore = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const hasTranslation = node.querySelector && (
                            node.querySelector('[data-ai-translated="true"]') ||
                            node.querySelector('.ai-translation-immersive') ||
                            node.hasAttribute('data-ai-translated')
                        );
                        
                        if (hasTranslation || node.classList?.contains('ai-translation-immersive')) {
                            shouldRestore = true;
                        }
                    }
                });
                
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        (node.tagName === 'IMG' || node.querySelector('img'))) {
                        shouldRestore = true;
                    }
                });
            });
            
            if (shouldRestore && detectTranslation()) {
                console.log('[图片保护器] 检测到翻译活动，准备恢复图片');
                setTimeout(() => {
                    restoreImages();
                    smartRestoreImages();
                }, 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-ai-translated', 'class']
        });
    }
    
    // 初始化
    function init() {
        console.log('[图片保护器] 用户脚本初始化中...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(init, 1000);
            });
            return;
        }
        
        // 创建控制面板
        createPanel();
        
        // 保存初始图片
        saveImages();
        
        // 开始监听
        startObserving();
        
        // 定期检查和恢复
        setInterval(() => {
            updatePanel();
            if (detectTranslation()) {
                restoreImages();
                smartRestoreImages();
            }
        }, 3000);
        
        console.log('[图片保护器] 初始化完成');
    }
    
    // 启动
    init();
    
})();