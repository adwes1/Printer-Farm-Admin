FROM node:24-alpine

RUN apk add --no-cache sqlite

WORKDIR /app

COPY package.json ./
COPY public ./public
COPY src ./src

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/data/printer-farm.sqlite
ENV INSTALL_FILE=/data/install.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

CMD ["node", "src/server.js"]
