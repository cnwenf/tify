#!/bin/bash

# AI Language Translator Chrome Extension Build Script
# 简化版构建脚本，适用于Linux环境

set -e  # 遇到错误时停止执行

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 输出带颜色的信息
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 构建配置
BUILD_DIR="$PROJECT_DIR/build"
DIST_DIR="$PROJECT_DIR/dist"
TEMP_DIR="$BUILD_DIR/temp"

# 从manifest.json读取版本号
if [[ -f "$PROJECT_DIR/manifest.json" ]]; then
    VERSION=$(grep '"version"' "$PROJECT_DIR/manifest.json" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    ZIP_NAME="ai-language-translator-v${VERSION}"
    log_info "检测到版本: $VERSION"
else
    log_error "manifest.json 文件未找到"
    exit 1
fi

# 需要包含的文件和目录
INCLUDE_FILES=(
    "manifest.json"
    "src/"
)

# 需要排除的文件和目录模式
EXCLUDE_PATTERNS=(
    "*.git*"
    "node_modules"
    "build"
    "dist"
    "*.DS_Store"
    "*.log"
    "*.tmp"
    "*.temp"
    "test.html"
    "validate_extension.py"
    "generate_icons.py"
    "INSTALLATION.md"
    "README.md"
    "build.sh"
    ".vscode"
    ".idea"
    "*.swp"
    "*.swo"
    "*~"
    "package.json"
    "package-lock.json"
    "scripts"
)

main() {
    log_info "开始构建 AI Language Translator Chrome 扩展..."
    
    # 检查zip命令
    if ! command -v zip &> /dev/null; then
        log_error "zip 命令未找到，请安装 zip 工具"
        exit 1
    fi
    
    # 创建构建目录
    log_info "创建构建目录..."
    rm -rf "$BUILD_DIR" "$DIST_DIR"
    mkdir -p "$DIST_DIR"
    mkdir -p "$TEMP_DIR"
    
    # 复制必需的文件到临时目录
    log_info "复制扩展文件..."
    
    # 复制manifest.json
    cp "$PROJECT_DIR/manifest.json" "$TEMP_DIR/"
    
    # 复制src目录
    cp -r "$PROJECT_DIR/src/" "$TEMP_DIR/"
    
    # 验证必要文件
    log_info "验证扩展文件..."
    
    REQUIRED_FILES=(
        "manifest.json"
        "src/popup/popup.html"
        "src/popup/popup.js"
        "src/popup/popup.css"
        "src/content/content.js"
        "src/content/content.css"
        "src/background/background.js"
        "src/assets/icon16.png"
        "src/assets/icon32.png"
        "src/assets/icon48.png"
        "src/assets/icon128.png"
    )
    
    ALL_VALID=true
    for file in "${REQUIRED_FILES[@]}"; do
        if [[ ! -f "$TEMP_DIR/$file" ]]; then
            log_error "必需文件缺失: $file"
            ALL_VALID=false
        fi
    done
    
    if [[ "$ALL_VALID" != true ]]; then
        log_error "文件验证失败"
        exit 1
    fi
    
    # 验证manifest.json格式
    if command -v python3 &> /dev/null; then
        if ! python3 -c "import json; json.load(open('$TEMP_DIR/manifest.json'))" 2>/dev/null; then
            log_error "manifest.json 格式错误"
            exit 1
        fi
    fi
    
    # 创建压缩包
    log_info "创建Chrome商店发布包..."
    cd "$TEMP_DIR"
    
    # 创建商店发布版ZIP文件
    STORE_ZIP="$DIST_DIR/${ZIP_NAME}-store.zip"
    zip -r "$STORE_ZIP" . -x "*.DS_Store" "*.git*" > /dev/null
    
    # 创建开发版ZIP文件
    DEV_ZIP="$DIST_DIR/${ZIP_NAME}-dev.zip"  
    cp "$STORE_ZIP" "$DEV_ZIP"
    
    # 创建开发者模式文件夹
    DEV_DIR="$DIST_DIR/extension-dev"
    cp -r "$TEMP_DIR" "$DEV_DIR"
    
    cd "$PROJECT_DIR"
    
    # 显示构建结果
    log_success "构建完成！"
    echo
    echo "构建文件位置："
    echo "  📦 Chrome商店发布版: $(basename "$STORE_ZIP")"
    echo "  📦 开发测试版: $(basename "$DEV_ZIP")"
    echo "  📁 开发者模式文件夹: extension-dev/"
    echo
    
    # 显示文件大小
    if [[ -f "$STORE_ZIP" ]]; then
        STORE_SIZE=$(du -h "$STORE_ZIP" | cut -f1)
        DEV_SIZE=$(du -h "$DEV_ZIP" | cut -f1)
        echo "文件大小："
        echo "  商店发布版: $STORE_SIZE"
        echo "  开发测试版: $DEV_SIZE"
        echo
    fi
    
    # 显示安装和发布说明
    echo "🚀 下一步操作："
    echo
    echo "1. 开发者模式测试："
    echo "   - 打开 Chrome 浏览器"
    echo "   - 访问 chrome://extensions/"
    echo "   - 开启右上角的 '开发者模式'"
    echo "   - 点击 '加载已解压的扩展程序'"
    echo "   - 选择文件夹: $DIST_DIR/extension-dev/"
    echo
    echo "2. Chrome 应用商店发布："
    echo "   - 访问 Chrome 开发者控制台: https://chrome.google.com/webstore/devconsole"
    echo "   - 创建新应用或更新现有应用"
    echo "   - 上传文件: $STORE_ZIP"
    echo "   - 填写应用商店信息（描述、截图、分类等）"
    echo "   - 提交审核"
    echo
    echo "3. 审核要点："
    echo "   - 确保应用描述准确"
    echo "   - 提供高质量的应用截图"
    echo "   - 遵守Chrome商店政策"
    echo "   - 确保隐私政策链接有效"
    echo
    
    # 运行扩展验证（如果可用）
    if [[ -f "$PROJECT_DIR/validate_extension.py" ]] && command -v python3 &> /dev/null; then
        log_info "运行扩展验证..."
        python3 "$PROJECT_DIR/validate_extension.py" "$TEMP_DIR" || log_warning "扩展验证失败，请检查代码"
    fi
    
    # 清理临时文件
    log_info "清理临时文件..."
    rm -rf "$BUILD_DIR"
    
    log_success "所有操作完成！扩展已准备好发布到 Chrome 应用商店。"
}

# 显示帮助信息
show_help() {
    echo "AI Language Translator Chrome Extension Build Script"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -c, --clean    清理构建目录"
    echo
    echo "示例:"
    echo "  $0              # 构建扩展"
    echo "  $0 --clean     # 清理构建文件"
    echo
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -c|--clean)
        log_info "清理构建目录..."
        rm -rf "$BUILD_DIR" "$DIST_DIR"
        log_success "构建目录已清理"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "未知选项: $1"
        show_help
        exit 1
        ;;
esac