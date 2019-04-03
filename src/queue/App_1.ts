import {AddToQueue, FromQueue, Job, Launcher, logger, NoneWorkerFactory, OnStart} from "ppspider";

class TestTask {

    @OnStart({
        urls: "",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async onStart(useless: any, job: Job) {
        logger.debug("add jobs to test queue");
        return ["job_1", "job_2", "job_3"];
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory
    })
    @AddToQueue({
        name: "test"
    })
    async fromQueue(useless: any, job: Job) {
        logger.debug("fetch job from test queue and execute: " + job.url());
        if (job.url() === "job_2") {
            return "job_4";
        }
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App_1 {}
