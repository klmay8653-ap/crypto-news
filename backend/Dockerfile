FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/
RUN npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/crypto.db"
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD npx prisma db push && node dist/index.js
