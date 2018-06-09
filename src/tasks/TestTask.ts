import {
    AddToQueue,
    AddToQueueData,
    FromQueue,
    Job,
    OnStart,
    OnTime,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory,
        parallel: {
            "0/20 * * * * ?": 1,
            "10/20 * * * * ?": 2
        }
    })
    @OnTime({
        urls: "http://www.baidu.com",
        cron: "*/30 * * * * ?",
        workerFactory: PuppeteerWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async index(page: Page, job: Job): AddToQueueData {
        await page.goto(job.url());
        return PuppeteerUtil.links(page, {
            "test": "http.*"
        });
    }

    @FromQueue({
        name: "test",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1,
        exeInterval: 100000
    })
    async printUrl(page: Page, job: Job) {
        console.log(job.url());
    }

}