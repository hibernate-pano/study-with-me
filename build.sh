#!/bin/bash

# 概念深挖器 - 构建/运行脚本（单应用：frontend）
# 用法:
#   ./build.sh --dev         启动开发服务器
#   ./build.sh --install     仅安装依赖
#   ./build.sh --build       安装依赖并构建
#   ./build.sh --prod        构建并启动生产服务器
#   ./build.sh --setup-env   创建 .env.local
#   ./build.sh --help        查看帮助

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info()    { echo -e "${BLUE}[信息]${NC} $1"; }
print_success() { echo -e "${GREEN}[成功]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
print_error()   { echo -e "${RED}[错误]${NC} $1"; }

setup_env_file() {
    local env_file=$1
    local example_file=$2
    if [ ! -f "$env_file" ]; then
        if [ -f "$example_file" ]; then
            cp "$example_file" "$env_file"
            print_warning "$env_file 已创建，请编辑填入 AI_API_KEY 等配置。"
        else
            print_error "示例文件 $example_file 不存在。"
            exit 1
        fi
    else
        print_info "$env_file 已存在，跳过创建。"
    fi
}

install_dependencies() {
    print_info "正在安装 frontend 依赖..."
    cd frontend
    npm install
    local ok=$?
    cd ..
    if [ $ok -ne 0 ]; then
        print_error "依赖安装失败。请检查网络或 package.json。"
        exit 1
    fi
    print_success "依赖安装完成。"
}

build_project() {
    print_info "正在构建 frontend..."
    cd frontend
    npm run build
    local ok=$?
    cd ..
    if [ $ok -ne 0 ]; then
        print_error "构建失败。"
        exit 1
    fi
    print_success "构建完成。"
}

start_dev() {
    print_info "启动开发服务器: http://localhost:3000"
    cd frontend
    npm run dev
}

start_prod() {
    print_info "启动生产服务器: http://localhost:3000"
    cd frontend
    npm start
}

show_help() {
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
}

main() {
    local action="${1:-dev}"

    case "$action" in
        --install) install_dependencies ;;
        --build)   install_dependencies; build_project ;;
        --dev)     install_dependencies; start_dev ;;
        --prod)    install_dependencies; build_project; start_prod ;;
        --setup-env)
            setup_env_file "frontend/.env.local" "frontend/.env.local.example"
            print_success "环境文件设置完成。"
            ;;
        --help|-h) show_help ;;
        *)
            print_error "未知参数: $action"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
