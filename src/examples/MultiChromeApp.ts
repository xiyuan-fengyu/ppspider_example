import {DbHelperUi, Job, Launcher, logger, OnStart, PuppeteerWorkerFactory, Transient} from "ppspider";

class TestTask {

    @Transient()
    private puppeteerWorkerFactories = [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true,
            args: [
                '--proxy-server=127.0.0.1:2007'
            ]
        }),
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true,
            args: [
                '--proxy-server=127.0.0.1:3000'
            ]
        })
    ];

    @OnStart({
        urls: ["0", "1"],
        parallel: 2,
        exeInterval: 0
    })
    async index(job: Job) {
        const page = await this.puppeteerWorkerFactories[+job.url].get();
        try {
            await page.goto("https://www.google.com");
            logger.debug(await page.evaluate(() => document.title));
        }
        finally {
            await page.close();
        }
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
    workerFactorys: []
})
class App {}