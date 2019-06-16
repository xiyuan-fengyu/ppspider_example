import {Job, Launcher, logger, NoneWorkerFactory, OnTime} from "ppspider";

class TestTask {

    @OnTime({
        urls: "",
        cron: "*/5 * * * * *",
        workerFactory: NoneWorkerFactory
    })
    async onTime(useless: any, job: Job) {
        logger.debug("this job will execute every 5 seconds", job);
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App {}
