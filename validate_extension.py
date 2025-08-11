#!/usr/bin/env python3
"""
Validate Chrome Extension Structure and Files
"""

import json
import os
from pathlib import Path

def check_file_exists(filepath):
    """Check if file exists and return status"""
    if os.path.exists(filepath):
        return "✅ 存在"
    else:
        return "❌ 缺失"

def check_manifest():
    """Validate manifest.json"""
    print("🔍 检查 manifest.json...")
    
    if not os.path.exists("manifest.json"):
        print("❌ manifest.json 文件不存在")
        return False
    
    try:
        with open("manifest.json", 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        required_fields = ["manifest_version", "name", "version", "description"]
        missing_fields = [field for field in required_fields if field not in manifest]
        
        if missing_fields:
            print(f"❌ manifest.json 缺少必需字段: {', '.join(missing_fields)}")
            return False
        
        print("✅ manifest.json 格式正确")
        print(f"   - 名称: {manifest.get('name')}")
        print(f"   - 版本: {manifest.get('version')}")
        print(f"   - Manifest 版本: {manifest.get('manifest_version')}")
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ manifest.json JSON 格式错误: {e}")
        return False

def check_files_structure():
    """Check required files and directory structure"""
    print("\n🔍 检查文件结构...")
    
    required_files = [
        "manifest.json",
        "src/popup/popup.html",
        "src/popup/popup.css", 
        "src/popup/popup.js",
        "src/content/content.js",
        "src/content/content.css",
        "src/background/background.js",
        "src/assets/icon16.png",
        "src/assets/icon32.png", 
        "src/assets/icon48.png",
        "src/assets/icon128.png"
    ]
    
    print("必需文件检查:")
    all_exist = True
    for file_path in required_files:
        status = check_file_exists(file_path)
        print(f"   {file_path}: {status}")
        if "❌" in status:
            all_exist = False
    
    optional_files = [
        "src/welcome/welcome.html",
        "test.html",
        "README.md",
        "INSTALLATION.md"
    ]
    
    print("\n可选文件检查:")
    for file_path in optional_files:
        status = check_file_exists(file_path)
        print(f"   {file_path}: {status}")
    
    return all_exist

def check_javascript_syntax():
    """Basic check for JavaScript files"""
    print("\n🔍 检查 JavaScript 语法...")
    
    js_files = [
        "src/popup/popup.js",
        "src/content/content.js", 
        "src/background/background.js"
    ]
    
    for js_file in js_files:
        if os.path.exists(js_file):
            try:
                with open(js_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Basic syntax checks
                if 'chrome.runtime' in content or 'chrome.storage' in content or 'chrome.tabs' in content:
                    print(f"   ✅ {js_file}: 包含 Chrome API 调用")
                else:
                    print(f"   ⚠️  {js_file}: 未检测到 Chrome API 调用")
                    
                # Check for common syntax issues
                if content.count('{') != content.count('}'):
                    print(f"   ❌ {js_file}: 大括号不匹配")
                elif content.count('(') != content.count(')'):
                    print(f"   ❌ {js_file}: 小括号不匹配")
                else:
                    print(f"   ✅ {js_file}: 基础语法检查通过")
                    
            except Exception as e:
                print(f"   ❌ {js_file}: 读取失败 - {e}")
        else:
            print(f"   ❌ {js_file}: 文件不存在")

def check_html_files():
    """Check HTML files"""
    print("\n🔍 检查 HTML 文件...")
    
    html_files = [
        "src/popup/popup.html",
        "src/welcome/welcome.html",
        "test.html"
    ]
    
    for html_file in html_files:
        if os.path.exists(html_file):
            try:
                with open(html_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if '<!DOCTYPE html>' in content:
                    print(f"   ✅ {html_file}: HTML5 文档类型正确")
                else:
                    print(f"   ⚠️  {html_file}: 缺少 HTML5 文档类型声明")
                    
                if '<script' in content and 'src=' in content:
                    print(f"   ✅ {html_file}: 包含外部脚本引用")
                elif '<script' in content:
                    print(f"   ✅ {html_file}: 包含内嵌脚本")
                else:
                    print(f"   ⚠️  {html_file}: 未检测到脚本")
                    
            except Exception as e:
                print(f"   ❌ {html_file}: 读取失败 - {e}")
        else:
            print(f"   ⚠️  {html_file}: 文件不存在")

def check_css_files():
    """Check CSS files"""
    print("\n🔍 检查 CSS 文件...")
    
    css_files = [
        "src/popup/popup.css",
        "src/content/content.css"
    ]
    
    for css_file in css_files:
        if os.path.exists(css_file):
            try:
                with open(css_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Count selectors
                selectors = content.count('{')
                print(f"   ✅ {css_file}: 包含 {selectors} 个 CSS 规则")
                
                # Check for common issues
                if content.count('{') != content.count('}'):
                    print(f"   ❌ {css_file}: 大括号不匹配")
                else:
                    print(f"   ✅ {css_file}: 语法检查通过")
                    
            except Exception as e:
                print(f"   ❌ {css_file}: 读取失败 - {e}")
        else:
            print(f"   ❌ {css_file}: 文件不存在")

def print_installation_info():
    """Print installation instructions"""
    print("\n" + "="*60)
    print("🚀 安装说明")
    print("="*60)
    print("1. 打开 Chrome 浏览器")
    print("2. 访问 chrome://extensions/")
    print("3. 开启右上角的 '开发者模式'")
    print("4. 点击 '加载已解压的扩展程序'")
    print("5. 选择本项目的根目录（包含 manifest.json 的目录）")
    print("6. 确认扩展出现在列表中")
    print("\n🔧 配置说明")
    print("1. 点击扩展图标打开弹窗")
    print("2. 选择 AI 模型")
    print("3. 展开 'API 设置' 并输入 API 密钥")
    print("4. 点击 '测试' 验证连接")
    print("5. 启用翻译开关")
    print("\n📝 测试说明")
    print("1. 打开 test.html 页面进行功能测试")
    print("2. 或者访问任意英文网页测试翻译功能")

def main():
    """Main validation function"""
    print("🔍 Tidy Chrome 扩展验证")
    print("="*60)
    
    # Change to script directory if manifest.json is not in current directory
    if not os.path.exists('manifest.json'):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        print(f"📁 切换到脚本目录: {script_dir}")
        os.chdir(script_dir)
    
    # Run all checks
    manifest_ok = check_manifest()
    files_ok = check_files_structure()
    
    check_javascript_syntax()
    check_html_files()
    check_css_files()
    
    print("\n" + "="*60)
    print("📊 验证结果汇总")
    print("="*60)
    
    if manifest_ok and files_ok:
        print("✅ 所有核心文件验证通过！")
        print("🎉 扩展已准备就绪，可以在 Chrome 中安装测试")
        print_installation_info()
    else:
        print("❌ 发现问题，请修复后重新验证")
        if not manifest_ok:
            print("   - manifest.json 需要修复")
        if not files_ok:
            print("   - 缺少必需文件")

if __name__ == "__main__":
    main()