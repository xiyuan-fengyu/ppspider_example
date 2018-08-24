import {DateUtil, Job, logger, NoneWorkerFactory, OnTime} from "ppspider";

export class TestTask {

    @OnTime({
        urls: "http://www.baidu.com",
        cron: "*/5 * * * * *",
        workerFactory: NoneWorkerFactory
    })
    async index(worker: any, job: Job) {
        logger.debug(DateUtil.toStr());
    }

}