import {Job, Launcher, OnStart, Page, PuppeteerUtil, PuppeteerWorkerFactory} from "ppspider";

class TestTask {

    @OnStart({urls: "https://www.baidu.com"})
    async test(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await page.goto(job.url);
        const title = await page.evaluate(async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return document.title;
        });
        console.log(title);
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory()
    ],
    webUiPort: 9001
})
class App {}
