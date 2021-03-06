import {Job, Launcher, logger, OnStart, Page, PuppeteerWorkerFactory} from "ppspider";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com"
    })
    async index(page: Page, job: Job) {
        await page.goto(job.url);
        const title = await page.evaluate(() => {
            debugger;
            const title = document.title;
            console.log(title);
            return title;
        });
        logger.debug(title);
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {

}