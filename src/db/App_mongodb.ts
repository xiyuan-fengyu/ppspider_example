import {appInfo, DbHelperUi, Job, Launcher, NetworkTracing, OnStart, PuppeteerWorkerFactory} from "ppspider";
import {Page} from "puppeteer";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    async index(page: Page, job: Job) {
        const networkTracing = new NetworkTracing(page);
        await page.goto(job.url, { waitUntil: 'networkidle0' });
        const pageRequests = networkTracing.requests();
        pageRequests["_id"] = job._id;
        // 保存的数据可以在
        await appInfo.db.save("networkTracing", pageRequests);
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    dbUrl: "mongodb://192.168.1.150:27017/ppspider",
    tasks: [
        TestTask
    ],
    dataUis: [
        DbHelperUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: true,
            devtools: false
        })
    ]
})
class App {

}