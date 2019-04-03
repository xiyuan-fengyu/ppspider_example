import {
    AddToQueue,
    AddToQueueData,
    DefaultJob,
    FromQueue,
    Job,
    Launcher, logger,
    NoFilter,
    PuppeteerWorkerFactory,
    RequestMapping
} from "ppspider";
import {Request, Response} from "express";
import {Page} from "puppeteer";
import * as request from "request";

class TestTask {

    // 申明一个 Rest Api用于接收请求，动态添加任务
    @RequestMapping("/addJob/test")
    @AddToQueue({
        name: "test",
        filterType: NoFilter
    })
    async addJobTest(req: Request, res: Response, next: any): AddToQueueData {
        const job = new DefaultJob(req.query.url);
        job.datas({
           notifyUrl: req.query.notifyUrl
        });
        res.send({
            success: true,
            message: "任务添加成功",
            jobId: job.id()
        });
        return job;
    }

    @FromQueue({
        name: "test",
        workerFactory: PuppeteerWorkerFactory
    })
    async test(page: Page, job: Job) {
        await page.goto(job.url());
        const title = await page.$eval("title", ele => ele.textContent);
        request({
            url: job.datas().notifyUrl,
            method: "POST",
            json: {
                job: {
                    id: job.id(),
                    url: job.url()
                },
                title: title
            }
        }, (error, response) => {
        });
    }

    // 申明一个 Rest Api 用于模拟 接收任务结果的异步通知
    @RequestMapping("/jobResult")
    async jobResult(req: Request, res: Response, next: any) {
        logger.info("收到任务执行结果的异步回调", req.body);
        res.send("ok");
    }

}

// 测试方式：启动后，浏览器访问 http://localhost:9000/addJob/test?url=https%3A%2F%2Fwww.baidu.com&notifyUrl=http%3A%2F%2Flocalhost%3A9000%2FjobResult

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {}
