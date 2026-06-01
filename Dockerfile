FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/provider-mock/package.json packages/provider-mock/
COPY packages/provider-manual/package.json packages/provider-manual/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages ./packages
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
