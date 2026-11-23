# PowerWork 在线部署

此目录提供 Linux x86_64 的预构建镜像部署配置。服务器需要 Git、支持数据卷子目录挂载的 Docker Engine，以及支持 `include` 和 `!reset` 的 Compose 插件。以下步骤适用于新建实例。

## 发布一次

在含有验收镜像的电脑执行下面的命令。登录密码提示处输入带 `write:packages` 的 GitHub classic Token。

```powershell
docker login ghcr.io -u ganggangtian
docker tag powerxi:full-split-hybrid-local ghcr.io/ganggangtian/powerxi:linux-amd64-v1
docker tag powerwork:local-docker ghcr.io/ganggangtian/powerwork:linux-amd64-v1
docker push ghcr.io/ganggangtian/powerxi:linux-amd64-v1
docker push ghcr.io/ganggangtian/powerwork:linux-amd64-v1
```

在 GitHub 个人主页的 **Packages** 核对两个镜像的可见性为 **Private**。将实际发布的引用填入 `.env.example`，正式发布使用 `镜像地址@sha256:完整摘要`。摘要从各自的 `docker push` 输出获取。

将此目录的部署文件放在 `ganggangtian/powerwork-images` 仓库根目录，提交并推送。已有 `.gitignore` 时合并 `/.env` 规则。服务器的 `.env` 和镜像仓库凭据在服务器本地保存。

## 在 Linux 服务器启动

确认 `uname -m` 输出 `x86_64`，并确认服务器可以访问 GitHub、GHCR 和基础设施镜像仓库。私有镜像的 Docker 登录使用具有包读取权限、带 `read:packages` 的 GitHub classic Token。

```sh
git clone https://github.com/ganggangtian/powerwork-images.git
cd powerwork-images
cp .env.example .env
docker login ghcr.io -u ganggangtian
```

首次启动前填好 `.env`。`POWERXI_PUBLIC_ORIGIN` 填浏览器实际访问的地址。通过内网 IP 直连时，`POWERXI_BIND_ADDRESS` 填服务器内网 IP。使用同机 HTTPS 反向代理时，保留 `127.0.0.1`，代理转发到 `127.0.0.1:4517`，公开地址填实际的 HTTPS 域名。实例名决定数据卷归属，后续更新沿用原值。

PostgreSQL 与 SeaweedFS 默认从 Docker Hub 拉取。如果服务器不能访问 Docker Hub，将这两个镜像同步到可访问的镜像仓库，然后在 `.env` 增加 `POWERXI_POSTGRES_IMAGE` 与 `POWERXI_STORAGE_IMAGE`，分别填写同步后的镜像引用。

在 `powerwork-images` 目录中执行：

```sh
docker compose config --quiet
docker compose up -d --wait
docker compose ps -a
```

初始化任务 `prepare` 和 `provision` 正常结束时显示 `Exited (0)`。其余服务应显示 `healthy`。工作台和管理后台路径分别为 `/chat` 与 `/admin/login`。管理员用户名为 `admin`。在服务器私有终端读取初始密码，首次登录时按页面提示设置新密码。

```sh
docker compose exec -T platform bun --no-env-file -e 'console.log(require("node:util").parseEnv(await Bun.file("/config/bundle/runtime.env").text()).ADMIN_ACCESS_KEY)'
```

核对 Agent 文件执行隔离：

```sh
docker compose exec -T -w /opt/powerxi/apps/agent/.mastra/output agent node --input-type=module - < check-file-sandbox.mjs
```
