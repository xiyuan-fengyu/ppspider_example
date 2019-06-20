import {AddToQueue, FromQueue, Job, Launcher, logger, NoneWorkerFactory, OnStart} from "ppspider";

class TestTask {

    @OnStart({
        urls: ""
    })
    @AddToQueue({
        name: "test"
    })
    async onStart() {
        logger.debug("add jobs to test queue");
        return ["job_1", "job_2", "job_3"];
    }

    @FromQueue({
        name: "test"
    })
    async fromQueue(job: Job) {
        logger.debug("fetch job from test queue and execute: " + job.url);
    }

}

@Launcher({
    workplace: "workplace_app0",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App_0 {}
