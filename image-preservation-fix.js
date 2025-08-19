/**
 * 图片保护解决方案 - 防止网页翻译时图片丢失
 * Image Preservation Solution - Prevent image loss during webpage translation
 */

class ImagePreservationManager {
    constructor() {
        this.preservedImages = new Map();
        this.observer = null;
        this.imageCounter = 0;
    }

    /**
     * 初始化图片保护机制
     */
    init() {
        this.preserveExistingImages();
        this.setupMutationObserver();
        this.setupTranslationDetection();
        console.log('图片保护机制已启动');
    }

    /**
     * 保护现有的图片元素
     */
    preserveExistingImages() {
        const images = document.querySelectorAll('img');
        const imageContainers = document.querySelectorAll('a[href*=".png"], a[href*=".jpg"], a[href*=".jpeg"], a[href*=".gif"], a[href*=".svg"]');
        
        // 保护图片元素
        images.forEach(img => this.protectImageElement(img));
        
        // 保护包含图片的链接容器
        imageContainers.forEach(container => this.protectImageContainer(container));
    }

    /**
     * 保护单个图片元素
     */
    protectImageElement(img) {
        const imageId = `preserved-image-${this.imageCounter++}`;
        const imageData = {
            src: img.src,
            alt: img.alt,
            style: img.getAttribute('style') || '',
            className: img.className,
            parent: img.parentElement,
            outerHTML: img.outerHTML
        };

        // 添加保护标记
        img.setAttribute('data-preserve-image', 'true');
        img.setAttribute('data-image-id', imageId);
        
        // 存储图片数据
        this.preservedImages.set(imageId, imageData);
        
        console.log(`已保护图片: ${imageId}`, imageData);
    }

    /**
     * 保护图片容器（包含图片的链接等）
     */
    protectImageContainer(container) {
        const containerId = `preserved-container-${this.imageCounter++}`;
        
        // 添加保护标记
        container.setAttribute('data-preserve-container', 'true');
        container.setAttribute('data-container-id', containerId);
        
        // 存储容器数据
        this.preservedImages.set(containerId, {
            outerHTML: container.outerHTML,
            parent: container.parentElement
        });
        
        console.log(`已保护图片容器: ${containerId}`);
    }

    /**
     * 设置DOM变化监听器
     */
    setupMutationObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    // 检查是否有图片被移除
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.handleRemovedNode(node);
                        }
                    });
                    
                    // 检查新添加的翻译结构
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.handleAddedNode(node);
                        }
                    });
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-ai-translated']
        });
    }

    /**
     * 处理被移除的节点
     */
    handleRemovedNode(node) {
        // 检查是否是受保护的图片或容器
        const protectedImages = node.querySelectorAll('[data-preserve-image="true"]');
        const protectedContainers = node.querySelectorAll('[data-preserve-container="true"]');
        
        protectedImages.forEach(img => {
            const imageId = img.getAttribute('data-image-id');
            console.log(`检测到受保护图片被移除: ${imageId}`);
            this.scheduleImageRestoration(imageId);
        });
        
        protectedContainers.forEach(container => {
            const containerId = container.getAttribute('data-container-id');
            console.log(`检测到受保护容器被移除: ${containerId}`);
            this.scheduleImageRestoration(containerId);
        });
    }

    /**
     * 处理新添加的节点
     */
    handleAddedNode(node) {
        // 检查是否是翻译后的结构
        if (node.classList && (node.classList.contains('ai-translation-immersive') || 
            node.hasAttribute('data-ai-translated'))) {
            console.log('检测到翻译结构，开始恢复图片');
            setTimeout(() => this.restoreImagesInTranslatedContent(node), 100);
        }
    }

    /**
     * 在翻译内容中恢复图片
     */
    restoreImagesInTranslatedContent(translatedNode) {
        // 查找可能的图片插入点
        const insertionPoints = this.findImageInsertionPoints(translatedNode);
        
        insertionPoints.forEach(point => {
            this.restoreImageAtPoint(point);
        });
    }

    /**
     * 查找图片插入点
     */
    findImageInsertionPoints(node) {
        const points = [];
        
        // 查找包含图片相关文本的元素
        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let textNode;
        while (textNode = walker.nextNode()) {
            const text = textNode.textContent;
            // 如果文本包含链接相关内容，标记为插入点
            if (text.includes('link1') || text.includes('link2') || text.includes('link3') ||
                text.includes('Examples from') || text.includes('示例')) {
                points.push({
                    node: textNode.parentElement,
                    position: 'before'
                });
            }
        }
        
        return points;
    }

    /**
     * 在指定点恢复图片
     */
    restoreImageAtPoint(point) {
        // 查找最合适的保存图片进行恢复
        for (const [id, imageData] of this.preservedImages) {
            if (imageData.outerHTML && imageData.outerHTML.includes('m3-bench-example.png')) {
                const imageElement = this.createImageFromData(imageData);
                
                if (point.position === 'before') {
                    point.node.parentElement.insertBefore(imageElement, point.node);
                } else {
                    point.node.parentElement.insertBefore(imageElement, point.node.nextSibling);
                }
                
                console.log(`已在翻译内容中恢复图片: ${id}`);
                break;
            }
        }
    }

    /**
     * 从数据创建图片元素
     */
    createImageFromData(imageData) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = imageData.outerHTML;
        const restoredElement = wrapper.firstChild;
        
        // 添加恢复标记
        restoredElement.setAttribute('data-restored-image', 'true');
        
        return restoredElement;
    }

    /**
     * 计划图片恢复
     */
    scheduleImageRestoration(imageId) {
        setTimeout(() => {
            this.restoreImage(imageId);
        }, 500);
    }

    /**
     * 恢复图片
     */
    restoreImage(imageId) {
        const imageData = this.preservedImages.get(imageId);
        if (!imageData) return;

        // 查找合适的插入位置
        const insertionPoint = this.findBestInsertionPoint(imageData);
        if (insertionPoint) {
            const restoredElement = this.createImageFromData(imageData);
            insertionPoint.appendChild(restoredElement);
            console.log(`已恢复图片: ${imageId}`);
        }
    }

    /**
     * 查找最佳插入位置
     */
    findBestInsertionPoint(imageData) {
        // 查找翻译后的相关内容
        const translatedElements = document.querySelectorAll('[data-ai-translated="true"]');
        
        for (const element of translatedElements) {
            const text = element.textContent;
            if (text.includes('Examples from') || text.includes('示例') || 
                text.includes('link1') || text.includes('链接1')) {
                return element.parentElement;
            }
        }
        
        // 如果找不到特定位置，返回body
        return document.body;
    }

    /**
     * 设置翻译检测
     */
    setupTranslationDetection() {
        // 监听可能的翻译触发事件
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => this.checkAndRestoreImages(), 2000);
        });
        
        // 定期检查图片完整性
        setInterval(() => {
            this.checkAndRestoreImages();
        }, 5000);
    }

    /**
     * 检查并恢复图片
     */
    checkAndRestoreImages() {
        const currentImages = document.querySelectorAll('img[src*="m3-bench-example.png"]');
        
        if (currentImages.length === 0) {
            console.log('检测到图片丢失，开始恢复...');
            
            // 查找翻译内容并恢复图片
            const translatedContent = document.querySelectorAll('[data-ai-translated="true"]');
            translatedContent.forEach(content => {
                this.restoreImagesInTranslatedContent(content);
            });
        }
    }

    /**
     * 销毁保护机制
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.preservedImages.clear();
        console.log('图片保护机制已停止');
    }
}

// 自动启动图片保护
const imagePreservation = new ImagePreservationManager();

// 页面加载完成后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        imagePreservation.init();
    });
} else {
    imagePreservation.init();
}

// 导出供外部使用
window.ImagePreservationManager = imagePreservation;

console.log('图片保护脚本已加载');