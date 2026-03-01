# HireClaw MVP 部署方案

## 架构总览

```
                    ┌─────────────┐
                    │   GitHub    │
                    │  (monorepo) │
                    └──────┬──────┘
                           │ push
                    ┌──────┴──────┐
                    │   GitHub    │
                    │   Actions   │
                    └──┬──────┬───┘
                       │      │
              ┌────────┘      └────────┐
              ▼                        ▼
     ┌────────────────┐      ┌────────────────┐
     │    Vercel       │      │    Fly.io       │
     │  (Next.js Web)  │      │  (Hono API)     │
     └───────┬────────┘      └───────┬────────┘
             │                       │
             │              ┌────────┴────────┐
             │              │      Neon        │
             │              │  (PostgreSQL)    │
             │              └─────────────────┘
             │
     ┌───────┴────────┐
     │   hireclaw.bot  │
     └────────────────┘
```

## 环境划分

| 项目 | Staging（测试） | Production（生产） |
|------|----------------|-------------------|
| **触发分支** | `develop` | `main` |
| **Web 域名** | `staging.hireclaw.bot` | `hireclaw.bot` |
| **API 域名** | `api-staging.hireclaw.bot` | `api.hireclaw.bot` |
| **Web 平台** | Vercel Preview | Vercel Production |
| **API 平台** | Fly.io (`hireclaw-api-staging`) | Fly.io (`hireclaw-api`) |
| **数据库** | Neon 分支库 | Neon 主库 |
| **最少实例** | 0（可休眠） | 1（常驻） |

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| Web | Next.js 15 + Tailwind v4 | SSR/SSG，部署到 Vercel |
| API | Hono + Node.js | RESTful API，Docker 部署到 Fly.io |
| ORM | Drizzle ORM | 类型安全的 SQL 查询 |
| 数据库 | PostgreSQL (Neon) | Serverless，免费 0.5GB |
| 包管理 | pnpm 9 | Monorepo workspace |
| 构建 | Turborepo | 增量构建 + 缓存 |
| CI/CD | GitHub Actions | 自动部署 |

## 分支与工作流

```
feature/*  ──► PR ──► develop  ──► 自动部署 Staging
                         │
                    验证通过后
                         │
                      PR ──► main  ──► 自动部署 Production
```

### 分支规则

- `main`：生产分支，受保护，仅通过 PR 合并
- `develop`：测试分支，功能开发完成后合并至此
- `feature/*`：功能分支，从 `develop` 拉出

---

## 第一步：创建外部服务账号

### 1.1 Neon（PostgreSQL）

1. 注册 [neon.tech](https://neon.tech)
2. 创建项目（Region: US West - Oregon）
3. 创建两个数据库分支：
   - `main`（生产）→ 获取 `DATABASE_URL`
   - `staging` → 获取 `DATABASE_URL_STAGING`
4. 运行数据库迁移：
   ```bash
   cd packages/db
   DATABASE_URL="postgres://..." pnpm run push
   ```

### 1.2 Fly.io

1. 安装 CLI：
   ```bash
   brew install flyctl
   fly auth login
   ```
2. 创建生产 App：
   ```bash
   fly apps create hireclaw-api
   ```
3. 创建测试 App：
   ```bash
   fly apps create hireclaw-api-staging
   ```
4. 设置 Secrets（两个 App 各自设置）：
   ```bash
   # Production
   fly secrets set DATABASE_URL="postgres://...prod..." \
                    JWT_SECRET="your-prod-jwt-secret" \
                    -a hireclaw-api

   # Staging
   fly secrets set DATABASE_URL="postgres://...staging..." \
                    JWT_SECRET="your-staging-jwt-secret" \
                    -a hireclaw-api-staging
   ```
5. 获取 Deploy Token：
   ```bash
   fly tokens create deploy -x 999999h
   ```
   保存输出的 token，后续配置到 GitHub Secrets。

### 1.3 Vercel

1. 安装 CLI：
   ```bash
   pnpm add -g vercel
   ```
2. 关联项目：
   ```bash
   cd apps/web
   vercel link
   ```
   - 选择或创建项目
   - Root Directory 设置为 `apps/web`
3. 配置环境变量（Vercel Dashboard → Settings → Environment Variables）：

   | 变量 | Production | Preview |
   |------|-----------|---------|
   | `NEXT_PUBLIC_API_URL` | `https://api.hireclaw.bot` | `https://api-staging.hireclaw.bot` |
| `STAGING_USER` | - | `your-staging-username` |
| `STAGING_PASS` | - | `your-strong-staging-password` |

4. 记录以下信息（后续配置到 GitHub Secrets）：
   ```bash
   # 在 .vercel/project.json 中获取
   cat apps/web/.vercel/project.json
   # → orgId, projectId

   # 创建 Token：https://vercel.com/account/tokens
   ```

---

## 第二步：配置 GitHub

### 2.1 GitHub Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 来源 |
|-------------|------|
| `FLY_API_TOKEN` | Fly.io deploy token |
| `VERCEL_TOKEN` | Vercel 个人 token |
| `VERCEL_ORG_ID` | `.vercel/project.json` 中的 `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` 中的 `projectId` |

### 2.2 分支保护（可选）

GitHub 仓库 Settings → Branches → Add rule：

**`main` 分支：**
- ✅ Require pull request before merging
- ✅ Require status checks to pass
- ✅ Require branches to be up to date

---

## 第三步：配置域名 DNS

在域名注册商（hireclaw.bot）的 DNS 管理中添加：

### Production

| 类型 | 名称 | 值 |
|------|------|-----|
| CNAME | `@` 或 `hireclaw.bot` | `cname.vercel-dns.com` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `api` | `hireclaw-api.fly.dev` |

### Staging

| 类型 | 名称 | 值 |
|------|------|-----|
| CNAME | `staging` | `cname.vercel-dns.com` |
| CNAME | `api-staging` | `hireclaw-api-staging.fly.dev` |

### 绑定自定义域名

```bash
# Fly.io
fly certs create api.hireclaw.bot -a hireclaw-api
fly certs create api-staging.hireclaw.bot -a hireclaw-api-staging

# Vercel：在 Dashboard → Settings → Domains 中添加
# hireclaw.bot
# staging.hireclaw.bot
```

---

## 第四步：首次部署

### 手动验证

```bash
# 1. 本地构建验证
pnpm build

# 2. 部署 Staging API
flyctl deploy --remote-only --config fly.staging.toml

# 3. 验证 Staging API
curl https://api-staging.hireclaw.bot/
# 期望输出: HireClaw API

# 4. 部署 Production API
flyctl deploy --remote-only --config fly.prod.toml

# 5. 部署 Web（首次手动）
cd apps/web
vercel --prod

# 6. 验证
curl https://hireclaw.bot
curl https://api.hireclaw.bot/
```

### 后续自动部署

推送到 `develop` 或 `main` 分支后，GitHub Actions 自动触发部署。

---

## 配置文件清单

```
hireclaw-mvp/
├── fly.prod.toml              # Fly.io 生产配置
├── fly.staging.toml           # Fly.io 测试配置
├── apps/api/
│   ├── Dockerfile             # API 多阶段构建
│   └── .dockerignore
└── .github/workflows/
    └── deploy.yml             # CI/CD 工作流
```

---

## 费用估算（MVP 阶段）

| 服务 | 免费额度 | 预计月费 |
|------|---------|---------|
| Vercel | 100GB 带宽，无限部署 | $0 |
| Fly.io | 3 shared VMs, 3GB 持久存储 | $0 |
| Neon | 0.5GB 存储，190 计算小时 | $0 |
| GitHub Actions | 2000 分钟/月 | $0 |
| **总计** | | **$0/月** |

> ⚠️ 注意：Fly.io 免费额度包含 staging + production 两个 App。staging 设置 `min_machines_running = 0` 以节省资源。

---

## 监控与日志

```bash
# Fly.io 日志
fly logs -a hireclaw-api
fly logs -a hireclaw-api-staging

# Fly.io 状态
fly status -a hireclaw-api

# Vercel 日志
# Dashboard → Deployments → 选择部署 → Functions 日志

# 数据库
# Neon Dashboard → Monitoring
```

---

## 回滚

### API（Fly.io）

```bash
# 查看历史版本
fly releases -a hireclaw-api

# 回滚到指定版本
fly deploy --image <previous-image> -a hireclaw-api
```

### Web（Vercel）

```bash
# Vercel Dashboard → Deployments → 选择历史版本 → Promote to Production
# 或 CLI：
vercel rollback
```
