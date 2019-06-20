import {
    appInfo,
    DbHelperUi,
    Job,
    Launcher,
    logger,
    NetworkTracing,
    OnStart,
    Page,
    PuppeteerWorkerFactory
} from "ppspider";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com"
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
    workplace: "workplace_mongodb",
    dbUrl: "mongodb://192.168.99.150:27017/ppspider",
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