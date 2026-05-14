# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG SPREE_API_URL
ARG SPREE_PUBLISHABLE_KEY
ARG GTM_ID
ARG SENTRY_DSN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ARG SPREE_WEBHOOK_SECRET
ARG RESEND_API_KEY
ARG EMAIL_FROM
ARG SENTRY_SEND_DEFAULT_PII=false
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DEFAULT_COUNTRY=us
ARG NEXT_PUBLIC_DEFAULT_LOCALE=en
ARG NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII=false

ENV SPREE_API_URL=${SPREE_API_URL} \
    SPREE_PUBLISHABLE_KEY=${SPREE_PUBLISHABLE_KEY} \
    GTM_ID=${GTM_ID} \
    SENTRY_DSN=${SENTRY_DSN} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT} \
    SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
    SPREE_WEBHOOK_SECRET=${SPREE_WEBHOOK_SECRET} \
    RESEND_API_KEY=${RESEND_API_KEY} \
    EMAIL_FROM=${EMAIL_FROM} \
    SENTRY_SEND_DEFAULT_PII=${SENTRY_SEND_DEFAULT_PII} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_DEFAULT_COUNTRY=${NEXT_PUBLIC_DEFAULT_COUNTRY} \
    NEXT_PUBLIC_DEFAULT_LOCALE=${NEXT_PUBLIC_DEFAULT_LOCALE} \
    NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII=${NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache tini && \
    addgroup -S nodejs && \
    adduser -S nextjs -G nodejs -u 10001

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3001/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
