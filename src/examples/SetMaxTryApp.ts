import {AddToQueue, FromQueue, Job, JobOverride, Launcher, OnStart} from "ppspider";

class TestTask {

    // 多种方法设置 maxTry，取最大值

    // 方法一，在 JobOverride 回调函数中修改 job,datas._.maxTry
    @JobOverride("OnStart_TestTask_root")
    overrideMaxTry(job: Job) {
        // 这里可以有条件地修改某些任务的最大尝试次数
        (job.datas._ || (job.datas._ = {} as any)).maxTry = 10;
        // 等价于
        // if (!job.datas._) {
        //     job.datas._ = {};
        // }
        // job.datas._.maxTry = 10;
    }

    @OnStart({urls: "root_job", maxTry: 5}) // 方法三，统一设置该类任务的最大尝试次数
    @AddToQueue({name: "sub_jobs"})
    async root(job: Job) {
        console.log(job.queue + " " + job.datas._.maxTry);

        // 方法二，用子任务的url构建job，并设置job的maxTry
        return new Job({
            url: "sub_job",
            datas: {
                _: {
                    maxTry: 10
                }
            }
        });
    }

    @FromQueue({name: "sub_jobs"})
    async sub(job: Job) {
        console.log(job.queue + " " + job.datas._.maxTry);
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    workerFactorys: [
    ],
    webUiPort: 9001
})
class App {}
