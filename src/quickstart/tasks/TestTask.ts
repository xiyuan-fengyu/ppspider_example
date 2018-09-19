import {
    Job,
    logger,
    mainMessager,
    MainMessagerEvent,
    NoneWorkerFactory,
    OnStart, PromiseUtil,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
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

        // 等待 3000 毫秒 后启动 OnStart_TestTask_noneWorkerTest 这个队列
        await PromiseUtil.sleep(3000);
        mainMessager.emit(MainMessagerEvent.QueueManager_QueueToggle_queueNameRegex_running, "OnStart_TestTask_noneWorkerTest", true);
    }

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory,
        running: false, // 系统启动后这个队列处于等待状态，直到这个状态被改为 true
        parallel: 1,
        exeInterval: 10000
    })
    async noneWorkerTest(worker: any, job: Job) {
        console.log("noneWorkerTest", worker, job);
    }

}