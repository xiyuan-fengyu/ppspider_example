
appJsPath="./lib/App.js"
args='
-env=prod
'

export PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors/
sudo npm install


tsc -w false


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
        allStop=0
        while [[ $allStop == 0 ]]; do
            allStop=1
            for pid in $relatedPids; do
                if ps -p $pid > /dev/null; then
                   echo -e ".\\c"
                   allStop=0
                   break
                fi
            done
            sleep 0.5
        done
        rm -rf pid
        echo -e "stopped"
    fi
fi
' > stop.sh
chmod +x stop.sh


# 准备 start.sh 脚本
echo -e '
cd $(cd `dirname $0`; pwd)
./stop.sh
nohup node '${appJsPath}' '${args}' 1>>main.log 2>&1 & echo $! > pid
' > start.sh
chmod +x start.sh


# 启动
./start.sh

