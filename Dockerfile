FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100 DATA_DIR=/state/data ASSETS_DIR=/state/assets
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node web ./web
USER node
EXPOSE 3100
CMD ["node", "server/container.js"]
