import {Launcher, logger, PuppeteerWorkerFactory} from "ppspider";
import {TestTask} from "./tasks/TestTask";
import {config} from "./config";

// import * as puppeteer from "puppeteer";
// logger.debug(puppeteer.executablePath());

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ]
})
class App {

}