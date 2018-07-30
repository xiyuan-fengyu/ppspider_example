import {Launcher, PuppeteerWorkerFactory} from "ppspider";
import {QqMusicTask} from "./task/QqMusicTask";
import {config} from "./config";

/**
 * 抓取 qq 音乐的信息 和 前 config.commentPages 页的评论
 * 抓取到的信息全部以json格式存储到文件中
 */
@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        QqMusicTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory(config.puppeteer)
    ],
    logger: config.logger
})
class App {

}