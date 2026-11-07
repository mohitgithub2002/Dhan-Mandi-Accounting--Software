# Mandi Khata — production image (Next.js standalone + migrate / seed / backup scripts)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# pg_dump for backups (client major version must be >= server) and python3 for backup rotation
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client python3 ca-certificates \
  && apt-get clean
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Scripts (migrate, seed, backup) run with tsx from the full node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && node server.js"]
