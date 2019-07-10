import {
    appInfo,
    Autowired,
    Bean,
    DbHelperUi,
    Job,
    Launcher,
    OnStart,
    Page,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    RequestUtil,
    Transient
} from "ppspider";
import * as Cheerio from "cheerio";

@Bean()
export class ProxyPool {

    async clear() {
        await appInfo.db.remove("proxy", {}, true);
    }

    async add(url: string) {
        await appInfo.db.save("proxy", {
            _id: url,
            createTime: new Date().getTime()
        });
    }

    async remove(urlOrQuery: string | Object) {
        return await appInfo.db.remove("proxy",
            typeof urlOrQuery == "string" ? {_id: urlOrQuery} : urlOrQuery, true);
    }

    async count(query: any = {}) {
        return await appInfo.db.count("proxy", query);
    }

    /**
     * 随机选取一个
     */
    async randomProxy(): Promise<string> {
        const total = await this.count();
        const randomI = parseInt("" + total * Math.random());
        const list = await appInfo.db.findList("proxy", {}, {_id: true},
            {}, randomI, 1);
        const proxy = list[0]._id;
        await this.updateLastUseTime(proxy);
        return proxy;
    }

    /**
     * 选取最近最久未使用的
     */
    async lruProxy(): Promise<string> {
        const list = await appInfo.db.findList("proxy", {}, {_id: true},
            {lastUseTime: 1}, 0, 1);
        const proxy = list[0]._id;
        await this.updateLastUseTime(proxy);
        return proxy;
    }

    private async updateLastUseTime(url: string) {
        await appInfo.db.update("proxy", {_id: url}, {
            $set: {
                lastUseTime: new Date().getTime()
            }
        }, false);
    }

}

class TestTask {

    // 序列化时，忽略这个字段
    @Transient()
    // 注入 ProxyPool
    @Autowired()
    private proxyPool: ProxyPool;

    @OnStart({urls: ""})
    async addProxy() {
        await this.proxyPool.add("http://127.0.0.1:2007");
        await this.proxyPool.add("http://test:123456@192.168.99.149:9090");
        appInfo.queueManager.setQueueRunning("OnStart_TestTask_.*Page", true);
    }

    // 使用 puppeteer + proxy 抓取动态网页
    @OnStart({
        urls: [
            "https://www.baidu.com/",
            "https://www.bilibili.com/"
        ],
        running: false
    })
    async dynamicPage(page: Page, job: Job) {
        const proxy = await this.proxyPool.lruProxy();
        await PuppeteerUtil.useProxy(page, proxy);
        await page.goto(job.url);
        console.log(await page.evaluate(() => document.title) + "    proxy: " + proxy);
    }

    // 使用 request + proxy + cheerio 抓取静态网页
    @OnStart({
        urls: "http://quotes.toscrape.com/",
        running: false
    })
    async staticPage(job: Job) {
        const proxy = await this.proxyPool.lruProxy();
        const htmlRes = await RequestUtil.simple({
            url: job.url,
            proxy: proxy
        });
        const $ = Cheerio.load(htmlRes.body);
        console.log($("title").text() + "    proxy: " + proxy);
    }

}

@Launcher({
    workplace: "workplace_quotes",
    tasks: [
        TestTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ],
    webUiPort: 9001
})
class App {}
