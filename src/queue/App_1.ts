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
    @AddToQueue({
        name: "test"
    })
    async fromQueue(job: Job) {
        logger.debug("fetch job from test queue and execute: " + job.url);
        if (job.url === "job_2") {
            return "job_4";
        }
    }

}

@Launcher({
    workplace: "workplace_app1",
    tasks: [
        TestTask
    ],
    workerFactorys: []
})
class App_1 {}
