import {AddToQueue, FromQueue, Job, Launcher, logger, NoneWorkerFactory, OnTime} from "ppspider";

class TestTask {

    @OnTime({
        urls: "",
        cron: "* */1 * * * *", // 每分钟执行一次
        workerFactory: NoneWorkerFactory // 由于该任务不需要使用 puppeteer 打开网页，所以采用 NoneWorkerFactory
    })
    @AddToQueue({
        name: "sub_jobs" // 将返回的字符串通过 @AddToQueue 转换为Job，并添加到 sub_jobs 队列
    })
    async onStart(useless: any, job: Job) {
        return "aSubJob_" + new Date().getTime();
    }

    @FromQueue({
        name: "sub_jobs", // 从 sub_jobs 队列获取Job，并通过 runSubJob 方法执行
        workerFactory: NoneWorkerFactory,
        parallel: {
            "0 0 8 * * *": 5, // 早上8点设置并行数为5
            "0 0 20 * * *": 0 // 晚上20点设置并行数为0，即该队列暂停工作
        }
    })
    async runSubJob(useless: any, job: Job) {
        logger.debug("run sub job: " + job.url);
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App {}
