import {
    AddToQueue,
    AddToQueueData,
    FromQueue,
    Job,
    logger,
    NoFilter,
    NoneWorkerFactory,
    RequestMapping,
} from "ppspider";
import {Request, Response} from "express";

export class TestTask {

    @RequestMapping("/addJob/test")
    @AddToQueue({
        name: "test",
        filterType: NoFilter
    })
    async addJobTest(req: Request, res: Response, next: any): AddToQueueData {
        res.send({
            success: true
        });
        return req.query.url;
    }

    @FromQueue({
        name: "test",
        workerFactory: NoneWorkerFactory,
        parallel: 1,
        exeInterval: 1000
    })
    async printUrl(useless: any, job: Job) {
        logger.debug(job.url());
    }

}