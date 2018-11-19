import {Launcher, logger, PuppeteerWorkerFactory} from "ppspider";
import {TestTask} from "./tasks/TestTask";
import {config} from "./config";

// 打印 当前puppeteer版本对应的chromium的下载地址和本地保存目录
import * as puppeteer from "puppeteer";
const chromiumInfo = (puppeteer as any).createBrowserFetcher({})
    .revisionInfo(require("puppeteer/package.json").puppeteer.chromium_revision);
logger.debug("", "download url: " + chromiumInfo.url, "chromium path: " + chromiumInfo.executablePath.replace(/\\/g, '/'));

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