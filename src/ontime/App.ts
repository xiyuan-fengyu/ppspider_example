import {Launcher, PuppeteerWorkerFactory} from "ppspider";
import {TestTask} from "./tasks/TestTask";

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        // 这个例子中没有用到 puppeteer, 所以不用注入 PuppeteerWorkerFactory 实例
        // new PuppeteerWorkerFactory({
        //     headless: false
        // })
    ]
})
class App {

}