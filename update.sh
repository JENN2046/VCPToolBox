#!/bin/bash

# 检查是否在Git仓库中
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo "Error: Not inside a Git repository."
    exit 1
fi

# 暂存当前工作目录的更改
git stash

# 获取上游更新
git fetch upstream

# 合并上游的main分支到当前分支
git merge upstream/main

# 应用stash
git stash pop

# 检查合并是否成功
if [ $? -ne 0 ]; then
    echo "Merge conflict detected. Please resolve conflicts manually and then run 'git stash pop' to apply your stashed changes."
    exit 1
fi

echo "Update completed successfully!"