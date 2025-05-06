#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装。请先安装 $1。"
        exit 1
    fi
}

# 检查环境文件是否存在，不存在则从示例文件复制
setup_env_file() {
    local env_file=$1
    local example_file=$2

    if [ ! -f "$env_file" ]; then
        if [ -f "$example_file" ]; then
            cp "$example_file" "$env_file"
            print_warning "$env_file 已从示例文件创建。请编辑此文件填入正确的配置信息。"
        else
            print_error "示例文件 $example_file 不存在，无法创建 $env_file。"
            exit 1
        fi
    else
        print_info "$env_file 已存在，跳过创建。"
    fi
}

# 安装依赖
install_dependencies() {
    local dir=$1

    print_info "正在安装 $dir 依赖..."
    cd $dir
    npm install
    if [ $? -eq 0 ]; then
        print_success "$dir 依赖安装完成。"
    else
        print_error "$dir 依赖安装失败。"
        print_warning "尝试清除 node_modules 并重新安装..."
        rm -rf node_modules
        npm cache clean --force
        npm install
        if [ $? -eq 0 ]; then
            print_success "$dir 依赖安装完成。"
        else
            print_error "$dir 依赖安装失败。请检查 package.json 中的依赖版本是否兼容。"
            exit 1
        fi
    fi
    cd ..
}

# 构建项目
build_project() {
    local dir=$1

    print_info "正在构建 $dir..."
    cd $dir
    npm run build
    if [ $? -eq 0 ]; then
        print_success "$dir 构建完成。"
    else
        print_error "$dir 构建失败。"
        exit 1
    fi
    cd ..
}

# 启动开发服务器
start_dev() {
    print_info "启动开发服务器..."

    # 启动后端
    print_info "启动后端服务器..."
    cd backend
    npm run dev &
    BACKEND_PID=$!
    cd ..

    # 启动前端
    print_info "启动前端服务器..."
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..

    print_success "开发服务器已启动！"
    print_info "前端服务器: http://localhost:3000"
    print_info "后端服务器: http://localhost:4000"
    print_info "按 Ctrl+C 停止所有服务器"

    # 捕获 SIGINT 信号 (Ctrl+C)
    trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT

    # 等待子进程
    wait
}

# 启动生产服务器
start_prod() {
    print_info "启动生产服务器..."

    # 启动后端
    print_info "启动后端服务器..."
    cd backend
    npm run start &
    BACKEND_PID=$!
    cd ..

    # 启动前端
    print_info "启动前端服务器..."
    cd frontend
    npm run start &
    FRONTEND_PID=$!
    cd ..

    print_success "生产服务器已启动！"
    print_info "前端服务器: http://localhost:3000"
    print_info "后端服务器: http://localhost:4000"
    print_info "按 Ctrl+C 停止所有服务器"

    # 捕获 SIGINT 信号 (Ctrl+C)
    trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT

    # 等待子进程
    wait
}

# 显示帮助信息
show_help() {
    echo "使用方法: ./build.sh [选项]"
    echo "选项:"
    echo "  --help          显示此帮助信息"
    echo "  --install       仅安装依赖"
    echo "  --build         安装依赖并构建项目"
    echo "  --dev           启动开发服务器（默认）"
    echo "  --prod          启动生产服务器"
    echo "  --setup-env     仅设置环境文件"
}

# 主函数
main() {
    # 检查必要的命令
    check_command node
    check_command npm

    # 解析命令行参数
    local action="dev"

    if [ $# -gt 0 ]; then
        case "$1" in
            --help)
                show_help
                exit 0
                ;;
            --install)
                action="install"
                ;;
            --build)
                action="build"
                ;;
            --dev)
                action="dev"
                ;;
            --prod)
                action="prod"
                ;;
            --setup-env)
                action="setup-env"
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    fi

    # 设置环境文件
    if [[ "$action" != "help" ]]; then
        print_info "检查环境文件..."
        setup_env_file "frontend/.env.local" "frontend/.env.local.example"
        setup_env_file "backend/.env" "backend/.env.example"
    fi

    # 根据操作执行相应的动作
    case "$action" in
        install)
            install_dependencies "frontend"
            install_dependencies "backend"
            ;;
        build)
            install_dependencies "frontend"
            install_dependencies "backend"
            build_project "frontend"
            build_project "backend"
            ;;
        dev)
            install_dependencies "frontend"
            install_dependencies "backend"
            start_dev
            ;;
        prod)
            install_dependencies "frontend"
            install_dependencies "backend"
            build_project "frontend"
            build_project "backend"
            start_prod
            ;;
        setup-env)
            print_success "环境文件设置完成。"
            ;;
    esac
}

# 执行主函数
main "$@"
