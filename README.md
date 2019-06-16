# ppspider example
安装依赖
```
set PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors/
npm install 
# 或则用yarn安装依赖（需要通过npm提前全局安装yarn：npm install yarn -g）
# yarn install
```

## src/quickstart
演示了 @OnStart 装饰器的作用  
在爬虫系统启动后，立即执行一个任务  

## src/ontime
演示了 @OnTime 装饰器的作用  
在爬虫启动后根据 cron 表达式周期性执行任务  
这例子中仅仅是每个5秒钟打印一次时间  

## src/queue
演示了 @AddToQueue @FromQueue 装饰器的作用    

## src/requestMapping
演示了 @RequestMapping 声明 HTTP rest 接口，提供远程动态添加任务的能力  
系统启动后，访问如下地址添加任务
```
curl http://localhost:9000/addJob/test?url=https%3A%2F%2Fwww.baidu.com&notifyUrl=http%3A%2F%2Flocalhost%3A9000%2FjobResult
```

## src/puppeteerUtil
演示了 PuppeteerUtil 工具类中一些方法的使用方式  

## src/debug  
演示了注入js的调试方法  

## src/dataSave
演示了几种数据保存方案  
由于抓到的大部分数据都是json格式的，建议使用1，然后根据实际数据需求，
后续再转存到其他存储介质中  
1. 保存到本地文件中  
2. 上传到服务器  
3. 存入 mysql  

## src/db
演示了 nedb / mongodb 的使用方式  
这两种数据库是内置封装好的，直接通过 appInfo.db 使用    
