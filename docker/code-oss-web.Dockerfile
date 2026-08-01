# Build & serve unmodified Code-OSS web workbench.
# Build context: vscode-main/vscode-main (upstream tree only).
#
#   docker compose -f docker/code-oss-web.compose.yml up --build

FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ libx11-dev libxkbfile-dev libsecret-1-dev libkrb5-dev \
    python3-dev pkg-config git ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /vscode

COPY . ./

ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN npm ci

RUN npm run compile-web

EXPOSE 8080

CMD ["node", "scripts/code-web.js", "--host", "0.0.0.0", "--port", "8080", "--browserType", "none"]
