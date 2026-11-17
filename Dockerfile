# The backend has no build step: tsconfig.json is noEmit and imports carry
# explicit .ts extensions, so the image ships sources plus tsx.
# One image serves both processes; the mcp service overrides the command.
FROM node:22-slim

WORKDIR /usr/src/app

# package-lock.json was produced by npm 11, which tolerates a nested
# gcp-metadata resolution under promptfoo -> mongoose -> mongodb that the
# npm 10 bundled with node:22 rejects as out of sync. Pin the same npm the
# project already uses (see web/package.json packageManager) so `npm ci`
# validates the lockfile the same way it does on a developer machine.
RUN npm install -g npm@11.9.0

# npm ci must keep devDependencies: tsx lives there. Do not set
# NODE_ENV=production here, or the runtime loader is left out of the image.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

# logs/ is gitignored and excluded by .dockerignore, so create it owned by
# node: the named volume mounted here is seeded from this directory and
# inherits its ownership, which a read_only root filesystem depends on.
RUN mkdir -p logs && chown node:node logs

USER node

EXPOSE 3001

# `node --import tsx` keeps the app as PID 1 with no wrapper process, so the
# SIGINT/SIGTERM handlers in app/main.ts receive signals directly and can
# close the server, graph, MCP client and tracer.
CMD ["node", "--import", "tsx", "app/main.ts"]
