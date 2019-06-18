import {appInfo, DbHelperUi, Job, Launcher, logger, NetworkTracing, OnStart, PuppeteerWorkerFactory} from "ppspider";
import {Page} from "puppeteer";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    async index(page: Page, job: Job) {
        const networkTracing = new NetworkTracing(page);
        await page.goto(job.url, { waitUntil: 'networkidle2' });
        const pageRequests = networkTracing.requests();
        pageRequests["_id"] = job._id;
        await appInfo.db.save("networkTracing", pageRequests);
        logger.info(`open http://localhost:9000/#/dataUi/DbHelperUi, choose networkTracing collection and submit, you will see the saved data.`);
    }

}

@Launcher({
    workplace: "workplace_nedb",
    // dbUrl: "nedb://workplace_nedb/nedb",
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