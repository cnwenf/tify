#!/bin/bash

# 图片翻译保护器安装脚本
echo "🖼️ 图片翻译保护器 (Image Translation Protector) 安装脚本"
echo "=================================================="

# 检查是否在正确的目录
if [ ! -f "manifest.json" ]; then
    echo "❌ 错误：请在包含manifest.json的目录中运行此脚本"
    exit 1
fi

echo "📁 当前目录包含以下文件："
ls -la

echo ""
echo "🔧 安装选项："
echo "1. Chrome扩展安装 (推荐)"
echo "2. 用户脚本安装 (需要Tampermonkey)"
echo "3. 显示使用说明"

read -p "请选择安装方式 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Chrome扩展安装步骤："
        echo "1. 打开Chrome浏览器"
        echo "2. 访问 chrome://extensions/"
        echo "3. 启用右上角的'开发者模式'"
        echo "4. 点击'加载已解压的扩展程序'"
        echo "5. 选择当前目录: $(pwd)"
        echo ""
        echo "✅ 安装完成后，扩展将自动开始工作"
        echo "💡 点击扩展图标可查看状态和手动控制"
        ;;
    2)
        echo ""
        echo "📜 用户脚本安装步骤："
        echo "1. 安装Tampermonkey扩展 (从Chrome商店)"
        echo "2. 打开 image-translation-protector.user.js"
        echo "3. 复制所有内容"
        echo "4. 在Tampermonkey中创建新脚本并粘贴"
        echo "5. 保存并启用脚本"
        echo ""
        echo "✅ 安装完成后，访问任意网页会显示控制按钮"
        ;;
    3)
        echo ""
        echo "📖 使用说明："
        echo ""
        echo "🎯 解决的问题："
        echo "Chrome翻译功能会导致网页中的图片丢失"
        echo ""
        echo "🛠️ 工作原理："
        echo "1. 自动保存页面中的所有图片信息"
        echo "2. 监测Chrome翻译活动"
        echo "3. 翻译后自动恢复丢失的图片"
        echo ""
        echo "🧪 测试方法："
        echo "1. 打开 test.html 文件"
        echo "2. 使用Chrome翻译功能翻译页面"
        echo "3. 观察图片是否正常显示"
        echo ""
        echo "📋 支持的功能："
        echo "✅ 自动图片保护和恢复"
        echo "✅ 手动恢复控制"
        echo "✅ 实时状态监控"
        echo "✅ 支持链接图片"
        echo "✅ 保持原始样式"
        ;;
    *)
        echo "❌ 无效的选择"
        exit 1
        ;;
esac

echo ""
echo "🔗 更多信息请查看 README.md 文件"
echo "🐛 如遇问题，请检查浏览器控制台的错误信息"
echo ""
echo "感谢使用图片翻译保护器！ 🎉"