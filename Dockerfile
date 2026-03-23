FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG CACHEBUST=1
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/xavier-portfolio-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
