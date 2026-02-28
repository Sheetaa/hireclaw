FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/validators/package.json packages/validators/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

# Install all dependencies (need devDeps for tsx)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/validators/ packages/validators/
COPY packages/db/ packages/db/
COPY apps/api/ apps/api/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "--filter", "@hireclaw/api", "exec", "tsx", "src/index.ts"]
