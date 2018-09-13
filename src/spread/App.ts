import {Launcher, PuppeteerWorkerFactory} from "ppspider";
import {GithubSpreadTask} from "./tasks/GithubSpreadTask";
import {config} from "./config";

@Launcher({
    workplace: config.workplace,
    tasks: [
        GithubSpreadTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger
})
class App {

}
