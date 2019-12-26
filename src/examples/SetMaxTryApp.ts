import {Job, Launcher, logger, OnStart} from "ppspider";

class TestTask {

    // 默认该队列所有任务最大尝试次数为 3
    @OnStart({urls: ""})
    async try0(job: Job) {
        logger.debug(job.queue + ": " + job.tryNum);
        throw new Error();
    }

    // 设置该队列所有任务的最大尝试次数为 5
    @OnStart({urls: "", maxTry: 5})
    async try1(job: Job) {
        logger.debug(job.queue + ": " + job.tryNum);
        throw new Error();
    }

    // 设置该队列所有任务无限次尝试
    @OnStart({urls: "", maxTry: -1})
    async try2(job: Job) {
        logger.debug(job.queue + ": " + job.tryNum);
        throw new Error();
    }

    // 设置该队列所有任务无限次尝试
    @OnStart({urls: "", maxTry: -1})
    async try3(job: Job) {
        !job.datas._ && (job.datas._ = {});
        if (!job.datas._.maxTry) {
            // 有条件地设置某些任务的最大尝试次数
            job.datas._.maxTry = 5;
        }
        logger.debug(job.queue + ": " + job.tryNum);
        throw new Error();
    }

}

@Launcher({
    workplace: "workplace_maxTry",
    tasks: [
        TestTask
    ],
    workerFactorys: [
    ],
    webUiPort: 9000
})
class App {}
