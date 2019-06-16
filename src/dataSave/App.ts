import {Launcher, PuppeteerWorkerFactory} from "ppspider";
import {TestTask} from "./tasks/TestTask";
import {config} from "./config";

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ]
})
class App {

}