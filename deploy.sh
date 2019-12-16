# 参考 https://github.com/xiyuan-fengyu/ppspider_docker_deploy
ppspiderProjectRep=https://github.com/xiyuan-fengyu/ppspider_example
ppspiderStartCmd="node lib/quickstart/App.js"
ppspiderProject=`basename $ppspiderProjectRep .git`

if id -u ppspider >/dev/null 2>&1; then
    echo "user(ppspider) existed"
else
    # chromium在root用户下无法正常启动
    useradd ppspider
fi
if [ `whoami` != "ppspider" ];then
    su ppspider
fi
ppspiderWorkplace=/home/ppspider

cd $ppspiderWorkplace
if [[ -d "$ppspiderWorkplace/$ppspiderProject" ]]; then
    # update
    echo "Error: $ppspiderWorkplace/$ppspiderProject existed"
    exit -1
fi

# clone
git clone --progress $ppspiderProjectRep $ppspiderProject
cd $ppspiderProject

# 准备 update.sh 脚本
echo -e '
if [ `whoami` != "ppspider" ];then
    su ppspider
fi
cd $(cd `dirname $0`; pwd)

# update
git pull

# install npm dependencies
yarn install

# compile ts to js
tsc -w false
' > update.sh
chmod +x update.sh

# 准备 stop.sh 脚本
echo -e '
cd $(cd `dirname $0`; pwd)
if [[ -f "pid" ]]; then
    mainPid=$(cat pid)
    if [[ "$mainPid " != " " ]]; then
        relatedPids=$(ps -ef | grep "$mainPid" | awk '"'"'{print $2,$3}'"'"' | grep "$mainPid" | awk '"'"'{print $1}'"'"')
    fi
    if [[ "$relatedPids " != " " ]]; then
        echo "kill existed process $mainPid"
        kill $mainPid

        echo -e "wait\\c"
        sleep 0.25

        allStop=0
        while [[ $allStop == 0 ]]; do
            allStop=1
            for pid in $relatedPids; do
                if ps -p $pid > /dev/null; then
                    echo -e ".\\c"
                    kill -9 $pid
                    allStop=0
                    break
                fi
            done
            sleep 0.5
        done
        rm -rf pid
        echo -e "\\nstopped"
    fi
fi
' > stop.sh
chmod +x stop.sh

# 准备 start.sh 脚本
echo -e '
if [ `whoami` != "ppspider" ];then
    su ppspider
fi
cd $(cd `dirname $0`; pwd)
./stop.sh
# 备份日志
if [[ -f "main.log" ]];then
    if [[ ! -d "log_bak" ]];then
        mkdir log_bak
    fi
    mv main.log log_bak/main.log.`date "+%Y%m%d_%H%M%S"`
fi
echo "nohup '$ppspiderStartCmd' 1>>main.log 2>&1 & echo $! > pid"
nohup '$ppspiderStartCmd' 1>>main.log 2>&1 & echo $! > pid
timeout 10 tail -f main.log
' > start.sh
chmod +x start.sh

./update.sh
./start.sh