import {AddToQueue, FromQueue, Job, Launcher, logger, OnTime} from "ppspider";

class TestTask {

    @OnTime({
        urls: "",
        cron: "* */1 * * * *", // 每分钟执行一次
    })
    @AddToQueue({
        name: "sub_jobs" // 将返回的字符串通过 @AddToQueue 转换为Job，并添加到 sub_jobs 队列
    })
    async onStart() {
        return "aSubJob_" + new Date().getTime();
    }

    @FromQueue({
        name: "sub_jobs", // 从 sub_jobs 队列获取Job，并通过 runSubJob 方法执行
        parallel: {
            "0 0 8 * * *": 5, // 早上8点设置并行数为5
            "0 0 20 * * *": 0 // 晚上20点设置并行数为0，即该队列暂停工作
        }
    })
    async runSubJob(job: Job) {
        logger.debug("run sub job: " + job.url);
    }

}

@Launcher({
    workplace: "workplace_dyncmicParallel",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App {}
