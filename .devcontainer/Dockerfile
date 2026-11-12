FROM mcr.microsoft.com/devcontainers/javascript-node:5.2.5-24-bookworm

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

RUN printf '%s\n' '#!/bin/sh' 'exec /usr/bin/chromium --no-sandbox "$@"' \
  > /usr/local/bin/chromium-no-sandbox \
  && chmod 0755 /usr/local/bin/chromium-no-sandbox

ENV CHROME_PATH=/usr/local/bin/chromium-no-sandbox

USER node
