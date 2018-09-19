import {Launcher, PuppeteerWorkerFactory} from "ppspider";
import {GithubSpreadTask} from "./tasks/GithubSpreadTask";
import {config} from "./config";
import {TestTask} from "./tasks/TestTask";

@Launcher({
    workplace: config.workplace,
    tasks: [
        GithubSpreadTask,
        // TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger
})
class App {

}
