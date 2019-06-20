import {appInfo, Job, Launcher, logger, NoneWorkerFactory, OnStart, OnTime, PromiseUtil} from "ppspider";

class TestTask {

    @OnStart({
        urls: ""
    })
    async onStart() {
        await PromiseUtil.sleep(5000);
        // 等待5秒钟后通知 OnTime_TestTask_runJobEverySecond 队列开始执行
        appInfo.queueManager.setQueueRunning("OnTime_TestTask_runJobEverySecond", true);
    }

    @OnTime({
        urls: "",
        cron: "* * * * * *", // 每秒执行一次
        running: false // 系统启动后，该队列(OnTime_TestTask_runJobEverySecond)不执行；OnTime 类型的任务的队列名称格式：OnTime_类名_方法名；OnStart 类型的任务的队列名称格式：OnStart_类名_方法名
    })
    async runJobEverySecond(job: Job) {
        logger.debug("runJobEverySecond: ", job);
    }

}

@Launcher({
    workplace: "workplace_queueWaitToRun",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App {}
