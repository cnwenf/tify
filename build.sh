#!/bin/bash

# AI Language Translator Chrome Extension Build Script
# 用于macOS的构建脚本

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

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    # 检查是否在macOS上
    if [[ "$OSTYPE" != "darwin"* ]]; then
        log_warning "此脚本专为macOS设计，在其他系统上可能需要调整"
    fi
    
    # 检查zip命令
    if ! command -v zip &> /dev/null; then
        log_error "zip 命令未找到，请安装 zip 工具"
        exit 1
    fi
}

# 清理函数
cleanup() {
    log_info "清理临时文件..."
    rm -rf "$BUILD_DIR/temp"
}

# 设置陷阱，确保在脚本退出时清理
trap cleanup EXIT

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# 构建配置
BUILD_DIR="$PROJECT_DIR/build"
DIST_DIR="$BUILD_DIR/dist"
TEMP_DIR="$BUILD_DIR/temp"
ZIP_NAME="ai-language-translator"

# 从manifest.json读取版本号
if [[ -f "$PROJECT_DIR/manifest.json" ]]; then
    VERSION=$(grep '"version"' "$PROJECT_DIR/manifest.json" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    ZIP_NAME="${ZIP_NAME}-v${VERSION}"
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

# 需要排除的文件和目录（相对于项目根目录）
EXCLUDE_PATTERNS=(
    "*.git*"
    "node_modules/"
    "build/"
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
    ".vscode/"
    ".idea/"
    "*.swp"
    "*.swo"
    "*~"
)

main() {
    log_info "开始构建 AI Language Translator Chrome 扩展..."
    
    # 检查依赖
    check_dependencies
    
    # 创建构建目录
    log_info "创建构建目录..."
    rm -rf "$BUILD_DIR"
    mkdir -p "$DIST_DIR"
    mkdir -p "$TEMP_DIR"
    
    # 复制文件到临时目录
    log_info "复制扩展文件..."
    
    # 使用rsync复制文件，排除不需要的文件
    RSYNC_EXCLUDE=""
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        RSYNC_EXCLUDE="$RSYNC_EXCLUDE --exclude=$pattern"
    done
    
    # 如果有rsync，使用rsync；否则使用cp
    if command -v rsync &> /dev/null; then
        eval "rsync -av $RSYNC_EXCLUDE \"$PROJECT_DIR/\" \"$TEMP_DIR/\""
    else
        log_warning "rsync 未找到，使用 cp 命令（可能包含不需要的文件）"
        
        # 先复制必需的文件
        for file in "${INCLUDE_FILES[@]}"; do
            if [[ -e "$PROJECT_DIR/$file" ]]; then
                cp -r "$PROJECT_DIR/$file" "$TEMP_DIR/"
            fi
        done
        
        # 手动删除排除的文件
        for pattern in "${EXCLUDE_PATTERNS[@]}"; do
            find "$TEMP_DIR" -name "$pattern" -exec rm -rf {} + 2>/dev/null || true
        done
    fi
    
    # 验证必要文件
    log_info "验证扩展文件..."
    if [[ ! -f "$TEMP_DIR/manifest.json" ]]; then
        log_error "manifest.json 文件缺失"
        exit 1
    fi
    
    if [[ ! -d "$TEMP_DIR/src" ]]; then
        log_error "src 目录缺失"
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
    log_info "创建扩展压缩包..."
    cd "$TEMP_DIR"
    zip -r "$DIST_DIR/${ZIP_NAME}.zip" . -x "*.DS_Store" "*.git*" > /dev/null
    cd "$PROJECT_DIR"
    
    # 创建开发者模式文件夹
    log_info "创建开发者模式文件夹..."
    cp -r "$TEMP_DIR" "$DIST_DIR/extension-dev"
    
    # 显示构建结果
    log_success "构建完成！"
    echo
    echo "构建文件位置："
    echo "  📦 生产版本 (Chrome Web Store): $DIST_DIR/${ZIP_NAME}.zip"
    echo "  📁 开发版本 (开发者模式): $DIST_DIR/extension-dev/"
    echo
    echo "文件大小："
    if [[ -f "$DIST_DIR/${ZIP_NAME}.zip" ]]; then
        FILE_SIZE=$(du -h "$DIST_DIR/${ZIP_NAME}.zip" | cut -f1)
        echo "  压缩包大小: $FILE_SIZE"
    fi
    
    # 显示安装说明
    echo
    echo "🚀 安装说明："
    echo
    echo "方式1: 开发者模式安装（推荐用于测试）"
    echo "  1. 打开 Chrome 浏览器"
    echo "  2. 访问 chrome://extensions/"
    echo "  3. 开启右上角的 '开发者模式'"
    echo "  4. 点击 '加载已解压的扩展程序'"
    echo "  5. 选择文件夹: $DIST_DIR/extension-dev/"
    echo
    echo "方式2: Chrome Web Store 发布"
    echo "  1. 访问 Chrome 开发者控制台"
    echo "  2. 上传文件: $DIST_DIR/${ZIP_NAME}.zip"
    echo
    
    # 如果有额外的验证脚本，运行它
    if [[ -f "$PROJECT_DIR/validate_extension.py" ]] && command -v python3 &> /dev/null; then
        log_info "运行扩展验证..."
        python3 "$PROJECT_DIR/validate_extension.py" "$TEMP_DIR" || log_warning "扩展验证失败，请检查代码"
    fi
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
    echo "  -v, --verbose  详细输出"
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
        rm -rf "$BUILD_DIR"
        log_success "构建目录已清理"
        exit 0
        ;;
    -v|--verbose)
        set -x
        main
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