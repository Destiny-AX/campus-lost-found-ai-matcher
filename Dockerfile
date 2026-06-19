# 拾寻 - Docker 部署文件
# 适用于 Sealos / 任何容器平台
FROM node:18-alpine

WORKDIR /app

# 先复制 package.json 安装依赖（利用 Docker 缓存层）
COPY package*.json ./
RUN npm install --production

# 复制项目文件
COPY index.html style.css script.js ./
COPY api/ ./api/
COPY images/ ./images/
COPY local-server.js ./

# 环境变量
ENV PORT=4173
ENV NODE_ENV=production

# 暴露端口
EXPOSE 4173

# 启动命令
CMD ["node", "local-server.js"]
