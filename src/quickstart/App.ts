import {Job, Launcher, logger, NoneWorkerFactory, OnStart} from "ppspider";

class TestTask {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    async onStart(useless: any, job: Job) {
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
