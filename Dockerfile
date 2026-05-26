# 指定基于node:latest 这个镜像继续制作当前应用镜像
FROM node:20-alpine

# 将根目录下的文件都copy到container（运行此镜像的容器）文件系统的app文件夹下
ADD . /app/
# cd到app文件夹下
WORKDIR /app

# 安装项目依赖包
RUN npm install

# remove development dependencies(不会报错，但是大小变化不大)
#RUN npm prune --production

# 配置环境变量
ENV HOST 0.0.0.0
ENV PORT 80

# 根据 NODE_ENV 切换 .env 文件
ARG NODE_ENV
COPY .env.${NODE_ENV} .env

# 暴露8025端口
EXPOSE 80

# 启动容器时执行应用启动命令
CMD [ "node", "app.js" ]
