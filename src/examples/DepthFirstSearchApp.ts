import {
    AddToQueue,
    DefaultPriorityQueue,
    FromQueue,
    Job,
    JobOverride,
    Launcher,
    logger,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    Page
} from "ppspider";

class TestTask {

    @OnStart({
        urls: "https://www.bilibili.com"
    })
    @FromQueue({
        name: "dfs_queue",
        parallel: 2,
        exeInterval: 250
    })
    @AddToQueue({
        name: "dfs_queue",
        queueType: DefaultPriorityQueue,
        // filterType: BloonFilter
    })
    async dfsSearch(page: Page, job: Job) {
        logger.info(`depth=${job.depth}, url=${job.url}`);
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url);
        // 最大爬取深度 15 (zero-based)
        if (job.depth < 15) {
            return PuppeteerUtil.links(page, {
                dfs_queue: ".*\.bilibili\.com.*"
            });
        }
    }

    @JobOverride("dfs_queue")
    jobOverride(job: Job) {
        // 深度较大的排在队列前面，优先运行
        job.priority = -job.depth;
    }

}

@Launcher({
    workplace: "workplace_DepthFirstSearchApp",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: true,
            devtools: false
        })
    ],
    webUiPort: 9001
})
class DepthFirstSearchApp {}
