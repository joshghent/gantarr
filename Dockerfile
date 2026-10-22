FROM node:24.22.1-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24.22.1-alpine AS runner

WORKDIR /app

COPY --from=builder /app/.output .output
COPY --from=builder /app/package.json .

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
