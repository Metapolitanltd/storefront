# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DEFAULT_COUNTRY=us
ARG NEXT_PUBLIC_DEFAULT_LOCALE=en
ARG NEXT_PUBLIC_STORE_NAME
ARG NEXT_PUBLIC_STORE_DESCRIPTION
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ARG NEXT_PUBLIC_ADYEN_CLIENT_KEY
ARG NEXT_PUBLIC_ADYEN_ENVIRONMENT
ARG NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII=false
ARG STORE_SEO_TITLE
ARG STORE_META_DESCRIPTION
ARG STORE_META_KEYWORDS
ARG STORE_TWITTER
ARG STORE_FACEBOOK
ARG STORE_INSTAGRAM
ARG STORE_LOGO_URL
ARG STORE_SUPPORT_EMAIL

ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_DEFAULT_COUNTRY=${NEXT_PUBLIC_DEFAULT_COUNTRY} \
    NEXT_PUBLIC_DEFAULT_LOCALE=${NEXT_PUBLIC_DEFAULT_LOCALE} \
    NEXT_PUBLIC_STORE_NAME=${NEXT_PUBLIC_STORE_NAME} \
    NEXT_PUBLIC_STORE_DESCRIPTION=${NEXT_PUBLIC_STORE_DESCRIPTION} \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_PAYPAL_CLIENT_ID=${NEXT_PUBLIC_PAYPAL_CLIENT_ID} \
    NEXT_PUBLIC_ADYEN_CLIENT_KEY=${NEXT_PUBLIC_ADYEN_CLIENT_KEY} \
    NEXT_PUBLIC_ADYEN_ENVIRONMENT=${NEXT_PUBLIC_ADYEN_ENVIRONMENT} \
    NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII=${NEXT_PUBLIC_SENTRY_SEND_DEFAULT_PII} \
    STORE_SEO_TITLE=${STORE_SEO_TITLE} \
    STORE_META_DESCRIPTION=${STORE_META_DESCRIPTION} \
    STORE_META_KEYWORDS=${STORE_META_KEYWORDS} \
    STORE_TWITTER=${STORE_TWITTER} \
    STORE_FACEBOOK=${STORE_FACEBOOK} \
    STORE_INSTAGRAM=${STORE_INSTAGRAM} \
    STORE_LOGO_URL=${STORE_LOGO_URL} \
    STORE_SUPPORT_EMAIL=${STORE_SUPPORT_EMAIL} \
    EMAIL_FROM=${EMAIL_FROM}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=SPREE_API_URL \
    --mount=type=secret,id=SPREE_PUBLISHABLE_KEY \
    --mount=type=secret,id=GTM_ID \
    --mount=type=secret,id=SENTRY_DSN \
    --mount=type=secret,id=SENTRY_ORG \
    --mount=type=secret,id=SENTRY_PROJECT \
    --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    export SPREE_API_URL="$(cat /run/secrets/SPREE_API_URL 2>/dev/null || true)" && \
    export SPREE_PUBLISHABLE_KEY="$(cat /run/secrets/SPREE_PUBLISHABLE_KEY 2>/dev/null || true)" && \
    export GTM_ID="$(cat /run/secrets/GTM_ID 2>/dev/null || true)" && \
    export SENTRY_DSN="$(cat /run/secrets/SENTRY_DSN 2>/dev/null || true)" && \
    export SENTRY_ORG="$(cat /run/secrets/SENTRY_ORG 2>/dev/null || true)" && \
    export SENTRY_PROJECT="$(cat /run/secrets/SENTRY_PROJECT 2>/dev/null || true)" && \
    export SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN 2>/dev/null || true)" && \
    npm run build

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
