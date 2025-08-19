// 图片翻译保护器 - 内容脚本
(function() {
    'use strict';
    
    // 存储原始图片信息
    let originalImages = new Map();
    let isTranslationActive = false;
    let observer = null;
    let restoredCount = 0;
    
    // 检测翻译状态的函数
    function detectTranslation() {
        // 检查是否存在翻译相关的元素
        const translatedElements = document.querySelectorAll('[data-ai-translated="true"], .ai-translation-immersive, [data-gtm-vis-has-fired], [data-gtm-vis-first-on-screen], .VIpgJd-ZVi9od-aZ2wEe-wOHMyf, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf-ti6hGc');
        return translatedElements.length > 0;
    }
    
    // 保存页面中的所有图片信息
    function saveImages() {
        const images = document.querySelectorAll('img');
        const links = document.querySelectorAll('a');
        
        images.forEach((img, index) => {
            const imgInfo = {
                src: img.src,
                alt: img.alt || '',
                title: img.title || '',
                className: img.className,
                style: img.style.cssText,
                width: img.width,
                height: img.height,
                parentElement: img.parentElement,
                nextSibling: img.nextSibling,
                previousSibling: img.previousSibling,
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
    }
    
    // 恢复丢失的图片
    function restoreImages() {
        if (originalImages.size === 0) return;
        
        console.log('[图片保护器] 开始恢复图片...');
        
        originalImages.forEach((imgInfo, key) => {
            // 检查图片是否仍然存在
            const existingImg = document.querySelector(`img[src="${imgInfo.src}"]`);
            if (existingImg) return; // 图片仍然存在，跳过
            
            // 查找可能包含图片的翻译容器
            const translationContainers = document.querySelectorAll('.ai-translation-immersive, [data-ai-translated="true"]');
            
            translationContainers.forEach(container => {
                // 检查容器的原始文本是否可能包含图片
                const originalText = container.getAttribute('data-original-text') || 
                                   container.querySelector('.original-text')?.textContent || '';
                
                // 如果原始文本提到了图片相关内容（如alt文本），尝试恢复图片
                if (originalText.includes(imgInfo.alt) || 
                    originalText.includes('image') || 
                    originalText.includes('图') ||
                    originalText.includes('Examples') ||
                    originalText.includes('示例')) {
                    
                    // 创建新的图片元素
                    const newImg = document.createElement('img');
                    newImg.src = imgInfo.src;
                    newImg.alt = imgInfo.alt;
                    newImg.title = imgInfo.title;
                    newImg.className = imgInfo.className;
                    newImg.style.cssText = imgInfo.style;
                    
                    // 如果原来有父链接，也要恢复
                    if (imgInfo.parentLink) {
                        const newLink = document.createElement('a');
                        newLink.href = imgInfo.parentLink.href;
                        newLink.target = imgInfo.parentLink.target;
                        newLink.rel = imgInfo.parentLink.rel;
                        newLink.className = imgInfo.parentLink.className;
                        newLink.appendChild(newImg);
                        
                        // 插入到翻译容器后面
                        container.parentNode.insertBefore(newLink, container.nextSibling);
                    } else {
                        // 直接插入图片
                        container.parentNode.insertBefore(newImg, container.nextSibling);
                    }
                    
                    console.log(`[图片保护器] 已恢复图片: ${imgInfo.src}`);
                    restoredCount++;
                }
            });
        });
    }
    
    // 智能恢复图片 - 基于内容匹配
    function smartRestoreImages() {
        if (originalImages.size === 0) return;
        
        console.log('[图片保护器] 开始智能恢复图片...');
        
        // 查找所有段落和容器
        const paragraphs = document.querySelectorAll('p, div, section, article');
        
        originalImages.forEach((imgInfo, key) => {
            // 检查图片是否仍然存在
            const existingImg = document.querySelector(`img[src="${imgInfo.src}"]`);
            if (existingImg) return;
            
            // 尝试根据上下文找到合适的位置插入图片
            paragraphs.forEach(paragraph => {
                const text = paragraph.textContent.toLowerCase();
                
                // 检查是否包含与图片相关的关键词
                const keywords = ['example', 'architecture', 'figure', 'image', '示例', '架构', '图', '例子'];
                const hasKeyword = keywords.some(keyword => text.includes(keyword.toLowerCase()));
                
                if (hasKeyword || text.includes(imgInfo.alt.toLowerCase())) {
                    // 创建图片容器
                    const imgContainer = document.createElement('div');
                    imgContainer.style.cssText = 'text-align: center; margin: 10px 0;';
                    
                    // 创建图片
                    const newImg = document.createElement('img');
                    newImg.src = imgInfo.src;
                    newImg.alt = imgInfo.alt;
                    newImg.title = imgInfo.title;
                    newImg.style.cssText = imgInfo.style || 'max-width: 100%; height: auto;';
                    
                    // 如果有父链接，创建链接
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
                    
                    // 插入图片容器
                    paragraph.parentNode.insertBefore(imgContainer, paragraph.nextSibling);
                    
                    console.log(`[图片保护器] 智能恢复图片: ${imgInfo.src}`);
                    restoredCount++;
                    return; // 只插入一次
                }
            });
        });
    }
    
    // 监听DOM变化
    function startObserving() {
        if (observer) observer.disconnect();
        
        observer = new MutationObserver((mutations) => {
            let shouldRestore = false;
            
            mutations.forEach((mutation) => {
                // 检查是否有新的翻译元素出现
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
                
                // 检查是否有图片被移除
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
                }, 500); // 延迟执行以确保翻译完成
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
        console.log('[图片保护器] 初始化中...');
        
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(init, 1000);
            });
            return;
        }
        
        // 保存初始图片
        saveImages();
        
        // 开始监听
        startObserving();
        
        // 定期检查和恢复
        setInterval(() => {
            if (detectTranslation()) {
                restoreImages();
                smartRestoreImages();
            }
        }, 3000);
        
        console.log('[图片保护器] 初始化完成');
    }
    
    // 页面刷新时重新保存图片
    window.addEventListener('beforeunload', () => {
        saveImages();
    });
    
    // 监听来自弹出窗口的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'getStatus':
                sendResponse({
                    isActive: true,
                    saved: originalImages.size,
                    restored: restoredCount,
                    translationActive: detectTranslation()
                });
                break;
                
            case 'manualRestore':
                restoreImages();
                smartRestoreImages();
                sendResponse({
                    saved: originalImages.size,
                    restored: restoredCount
                });
                break;
                
            case 'refreshScan':
                restoredCount = 0; // 重置计数
                saveImages();
                sendResponse({
                    saved: originalImages.size,
                    restored: restoredCount
                });
                break;
        }
        return true;
    });
    
    // 启动
    init();
    
})();