# 部署过程  
在docker宿主机上，运行以下命令  
```bash
# 构建 ppspider_env image
echo -e '
FROM xiyuanfengyu/ppspider_env

ARG ROOT_PASSWORD=123456
ARG NPM_REGISTRY=https://registry.npm.taobao.org

ENV PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors/

RUN echo "${ROOT_PASSWORD}" | passwd --stdin root \
    && if [ "${NPM_REGISTRY} " != " " ];then (npm config set registry=${NPM_REGISTRY}) fi
' > Dockerfile
docker build -t ppspider_env .  
# 创建 ppspider_env container，命名为 my_ppspider_env，需要暴露 webUi端口 9000，mongodb端口 27017，需要根据实际情况决定要暴露的端口
docker run -itd -e "container=docker" --network=host -p 9000:9000 -p 27017:27017 --name my_ppspider_env ppspider_env /usr/sbin/init

# 部署项目
ppspiderWorkplace=/root/ppspider
ppspiderProjectRep=https://github.com/xiyuan-fengyu/ppspider_example
ppspiderStartCmd="node lib/quickstart/App.js"
ppspiderProject=`basename $ppspiderProjectRep .git`

echo -e '
cd '$ppspiderWorkplace'
if [[ -d "'$ppspiderWorkplace'/'$ppspiderProject'" && -d "'$ppspiderWorkplace'/'$ppspiderProject'/.git" ]]; then
    # update
    cd '$ppspiderProject'
    git pull
else
    # clone
    rm -rf '$ppspiderProject'
    git clone --progress '$ppspiderProjectRep' '$ppspiderProject'
    cd '$ppspiderProject'
fi
# install npm dependencies
yarn install
# compile ts to js
tsc -w false
echo "nohup '$ppspiderStartCmd' 1>main.log 2>&1 &"
nohup '$ppspiderStartCmd' 1>main.log 2>&1 &
timeout 30 tail -f main.log
' > /tmp/$ppspiderProject.sh
docker exec my_ppspider_env mkdir -p $ppspiderWorkplace
docker cp /tmp/$ppspiderProject.sh my_ppspider_env:$ppspiderWorkplace/$ppspiderProject.sh
docker exec my_ppspider_env chmod +x $ppspiderWorkplace/$ppspiderProject.sh
docker exec my_ppspider_env sh $ppspiderWorkplace/$ppspiderProject.sh
# docker stop my_ppspider_env && docker rm my_ppspider_env
```
