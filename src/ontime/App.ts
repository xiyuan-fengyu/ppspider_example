import {Job, Launcher, logger, OnTime} from "ppspider";

class TestTask {

    @OnTime({
        urls: "",
        cron: "*/5 * * * * *"
    })
    async onTime(job: Job) {
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
