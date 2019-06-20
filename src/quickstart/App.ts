import {Job, Launcher, logger, OnStart} from "ppspider";

class TestTask {

    @OnStart({
        urls: ""
    })
    async onStart(job: Job) {
        logger.debug("this job will execute after ppspider startup", job);
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
