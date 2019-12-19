import {
    AddToQueue,
    FromQueue,
    Job,
    Launcher,
    OnStart,
    Page,
    PromiseUtil,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    RequestUtil
} from "ppspider";

class TestTask {

    @OnStart({description: "今日头条汽车", urls: "https://www.toutiao.com/ch/car_new_arrival/", timeout: -1})
    @AddToQueue({name: "article_.*"})
    async car_new_arrival(job: Job, page: Page) {
        // 获取新闻列表的url
        const [feedUrlP, feedUrlR] = PromiseUtil.createPromiseResolve();
        page.on("request", async req => {
            if (req.url().indexOf("/api/pc/feed/") > -1) {
                // 无头模式下这个请求返回空字符串，拦截后自行发起请求才拿的到正确内容
                feedUrlR(req.url());
                await req.abort();
            }
        });

        // 启用请求拦截
        await page.setRequestInterception(true);
        // 禁止图片加载
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url);

        // 等待 新闻列表的url 获取成功
        const feedUrl: string = await feedUrlP;
        const cookies = await page.cookies(feedUrl);
        const cookieStr = cookies.map(item => item.name + "=" + item.value);
        // 自行通过RequestUtil发起请求，cookie是必须的，少了请求不成功
        const res = await RequestUtil.simple({
            url: feedUrl,
            headerLines: `
            accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3
            accept-encoding: gzip, deflate, br
            accept-language: zh-CN,zh;q=0.9
            cache-control: max-age=0
            upgrade-insecure-requests: 1
            cookie: ${cookieStr}
            user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
            `
        });
        const resJson = JSON.parse(res.body.toString("utf-8"));

        // 把结果添加到队列
        const addToQueue: {[queueName: string]: any[]} = {};
        for (let item of resJson.data) {
            // 有多种类型的文章，这里添加到对应的队列中
            // 后面只演示了处理 article 类型的文章
            const queueName = "article_" + item.article_genre;
            let arr = addToQueue[queueName];
            if (arr == null) {
                addToQueue[queueName] = arr = [];
            }
            arr.push(`https://www.toutiao.com/a${item.item_id}/`)
        }
        return addToQueue;
    }

    @FromQueue({name: "article_article", description: "汽车之家新闻详情页面"})
    async article(page: Page, job: Job) {
        // page.on("response", async res => {
        //     if (res.url() == job.url) {
        //         // 无头模式下这个请求返回空网页，拦截后自行发起请求才拿的到正确内容
        //         const body = await res.text();
        //         console.log(body);
        //     }
        // });

        const cookies = await page.cookies(job.url);
        const cookieStr = cookies.map(item => item.name + "=" + item.value);
        const htmlRes = await RequestUtil.simple({
            url: job.url,
            headerLines: `
            accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
            accept-encoding: gzip, deflate, br
            accept-language: zh-CN,zh;q=0.9
            cache-control: max-age=0
            cookie: ${cookieStr}
            referer: https://www.toutiao.com/ch/car_new_arrival/
            sec-fetch-mode: navigate
            sec-fetch-site: same-origin
            sec-fetch-user: ?1
            upgrade-insecure-requests: 1
            user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36
            `
        });

        page.on("request", async req => {
            if (req.url() == job.url) {
                // 模拟返回html内容，这正是 PuppeteerUtil.useProxy 的实现方式
                await req.respond({
                    status: htmlRes.status,
                    headers: htmlRes.headers as any,
                    contentType: "text/html",
                    body: htmlRes.body.toString("utf-8")
                });
            }
        });
        await page.setRequestInterception(true);
        await page.goto(job.url, {waitUntil: "networkidle2"});

        // 获取网页内容

    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    dataUis: [
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: true,
            args: [
                "--no-sandbox"
            ]
        })
    ]
})
class App {}
