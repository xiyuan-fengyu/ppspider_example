import {AddToQueue, FromQueue, Job, JobOverride, Launcher, logger, OnStart} from "ppspider";

class TestTask {

    @OnStart({
        urls: "onStart"
    })
    @AddToQueue({
        name: "test"
    })
    async onStart() {
        logger.debug("add jobs to test queue");
        return ["job_1", "job_2", "job_2#1", "job_3", "job_3#2"];
    }

    @JobOverride("test")
    overrideJobInfo(job: Job, parentJob: Job) {
        // job_2#1 和 job_3#2 两个任务的key将改为 job_2，job_3，然后被 BloonFilter 过滤掉
        job.key = job.url.split("#")[0];
        job.datas.referer = parentJob.url;
    }

    @FromQueue({
        name: "test"
    })
    async fromQueue(job: Job) {
        logger.debug("fetch job from test queue and execute: " + job.url + ", referer: " + job.datas.referer);
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
