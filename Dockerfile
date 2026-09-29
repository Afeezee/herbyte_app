# Local development container. Production is served by Vercel — this
# Dockerfile exists only for reproducing the dev environment (nginx +
# built SPA) when Vercel isn't convenient.
#
# It builds the Vite SPA and serves the static output behind nginx.
# The API (`api/` + `server/`) is Vercel-only and is NOT part of this
# image — point the SPA at a running `vercel dev` or the deployed
# API host via VITE_API_BASE if you need one.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
