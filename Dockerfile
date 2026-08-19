FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . /app
ENV HOST=0.0.0.0 PORT=8080 ELFLDR_PORT=9021
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "api/serve.js"]
