FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node . .
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "api/serve.js", "8080"]
