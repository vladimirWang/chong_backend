FROM nginx:alpine

# prod = www.hetou.vip；test = test.hetou.vip（对应 conf.d 下文件名）
ARG NGINX_SITE=prod
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./conf.d/${NGINX_SITE}.conf /etc/nginx/conf.d/site.conf

# 前端静态资源走 bind mount（compose 挂载 ../nginx/html/dist），不在镜像内打包；
# 发版 = pnpm build + rsync dist 到服务器，nginx 容器无需重启

# 删除 Alpine 默认 entrypoint 脚本（apk manifest 在国内会卡）
RUN rm -f /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh

# COPY ssl /etc/ssl/cert
