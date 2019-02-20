# ppspider example
安装依赖
```
set PUPPETEER_DOWNLOAD_HOST=https://npm.taobao.org/mirrors/
npm install
```

## src/quickstart
演示了 @OnStart 装饰器的作用  
在爬虫系统启动后，立即执行一个任务  
任务行为：  
打开 http://www.baidu.com  
加载完成后， 获取并打印所有以 http 开头的连接  

## src/ontime
演示了 @OnTime 装饰器的作用  
在爬虫启动后根据 cron 表达式周期性执行任务  
这例子中仅仅是每个5秒钟打印一次时间  

## src/queue
演示了 @AddToQueue @FromQueue 装饰器的左右  
任务行为： 
系统启动后，抓取所有 http 开头的连接，通过 @AddToQueue 添加到 test 队列中  
@FromQueue 则从 test 队列中获取任务，并交由 printUrl 方法处理    

## src/requestMapping
演示了 @RequestMapping 声明 HTTP rest 接口，提供远程动态添加任务的能力  
系统启动后，如下动态添加任务
```
curl http://localhost:9000/addJob/test?url=justTestForRequestMapping
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
4. @TODO 添加到 mongodb 
5. 存储到 nedb （类 mongodb 的serverless本地数据库）    

## src/bilibili  
爬取B站视频信息和前几页评论（包括全部楼中楼）  

## src/qqMusic
抓取 qq 音乐的信息 和 前 config.commentPages 页的评论  

## src/twitter
抓取推特上一些主题相关的讨论以及用户信息    

修改 src/twitter/movies.ts 添加主题  
每行一个  
```
export const movies =
`
主题1
主题2
主题3
`.split("\n").map(item => item.trim()).filter(item => item.length > 0);
```
运行前需要修改的配置  
src/twitter/config.ts   
dev.puppeteer.args --proxy-server=ip:port 设置代理  
dev.twitter.commentMaxNum 一个主题最多抓取多少条评论  

## src/spread
抓取 github 上对 爬虫感兴趣的用户，向他们发送邮件推荐自己的爬虫框架，
目前爬取功能已完成，邮件发送未实现，TODO
运行前需要在 lib/spread 目录下创建一个 github.cookie.local.txt 文件用于
提供github登陆之后的cookie信息（在chrome浏览器中登录github之后，从devTools的
Network 面板中查看一个请求，获取cookie信息）  
github.cookie.local.txt文件内容大致如下  
```
has_recent_activity=1; _octo=GH1.1.123.123; _ga=GA1.2.123.123; _gat=1; tz=Asia%2FBeiJing; user_session=sda-m1oGH0diAKQ_h0a; __Host-user_session_same_site=asd-asd; logged_in=yes; dotcom_user=asd; _gh_sess=asd%3D--asd
```
