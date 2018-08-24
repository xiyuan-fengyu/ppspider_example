import {Job, logger, NoneWorkerFactory, OnStart, PuppeteerUtil, PuppeteerWorkerFactory} from "ppspider";
import {Page} from "puppeteer";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    async index(page: Page, job: Job) {
        await page.goto(job.url());
        const urls = await PuppeteerUtil.links(page, {
            "all": "http.*"
        });
        logger.debugValid && logger.debug(JSON.stringify(urls, null, 4));
    }

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory,
        parallel: 1,
        exeInterval: 10000
    })
    async noneWorkerTest(worker: any, job: Job) {
        console.log("noneWorkerTest", worker, job);
    }

}