# 部署到 Railway 指南

## 步骤1：升级 Node.js

### 方法1：使用官方安装包（推荐）

1. 访问 Node.js 官网：https://nodejs.org/
2. 下载 **LTS 版本**（推荐 18.x 或 20.x）
3. 运行安装程序
4. 安装完成后，**重新打开 PowerShell**
5. 验证安装：
   ```bash
   node --version  # 应该显示 v18.x.x 或更高
   ```

### 方法2：使用 Chocolatey（如果已安装）

```bash
# 以管理员身份运行 PowerShell
choco install nodejs-lts -y
```

## 步骤2：安装 Railway CLI

升级 Node.js 后，运行：

```bash
npm install -g @railway/cli
```

## 步骤3：登录 Railway

```bash
railway login
```

这会打开浏览器让您登录/注册 Railway 账号。

## 步骤4：初始化项目

```bash
cd C:\Users\xxtxi\CodeBuddy\20251209082239
railway init
```

按提示选择：
- 创建新项目或选择已有项目
- 输入项目名称（如：lis-whiteboard）

## 步骤5：部署

```bash
railway up
```

等待部署完成，Railway 会自动：
- 检测到 Node.js 项目
- 运行 `npm install`
- 启动应用
- 分配公网域名

## 步骤6：配置环境变量

在 Railway 控制台设置：

```
PUBLIC_IP=your-railway-domain.railway.app
PUBLIC_PORT=443
```

## 步骤7：获取访问地址

部署完成后，Railway 会提供一个域名，如：
```
https://lis-whiteboard-production.up.railway.app
```

---

## 当前状态

✅ **腾讯云已部署**：http://49.233.107.65:8080
⏳ **Railway 待部署**：需要先升级 Node.js

---

## 快速对比

| 平台 | 状态 | 访问速度（国内） | 费用 |
|------|------|------------------|------|
| 腾讯云轻量服务器 | ✅ 已部署 | 快 | 按服务器计费 |
| Railway | ⏳ 待部署 | 较慢（海外） | 免费额度$5/月 |
