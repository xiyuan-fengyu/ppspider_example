import {Launcher, PuppeteerWorkerFactory} from "ppspider";
import {BilibiliTask} from "./tasks/BilibiliTask";

/*
抓取b站视频信息和评论信息
 */
@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        BilibiliTask
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