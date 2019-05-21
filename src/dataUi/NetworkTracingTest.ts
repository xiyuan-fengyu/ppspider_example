import {
    AddToQueue,
    appInfo,
    Autowired,
    DataUi,
    DataUiRequest,
    FromQueue,
    Job,
    Launcher,
    NetworkTracing,
    NoFilter,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    RequestMapping,
    Transient,
    ViewEncapsulation
} from "ppspider";
import {Page} from "puppeteer";
import {Request, Response} from "express";

@DataUi({
    label: "NetworkTracing测试",
    encapsulation: ViewEncapsulation.None,
    // language=CSS
    style: `        
        
    `,
    // language=Angular2HTML
    template: `
<div class="container-fluid">
    <div class="row" style="margin-top: 12px">
        <div class="col-sm-6">
            <form>
                <div class="form-group">
                    <label for="url">Url</label>
                    <input [(ngModel)]="url" id="url" name="url" class="form-control">
                </div>
                <button (click)="addJob(url)" [disabled]="url ? null : true" class="btn btn-primary">
                    Submit
                </button>
            </form>
        </div>
    </div>

    <div class="row" style="margin-top: 12px">
        <div class="col-md-12">
            <p *ngFor="let msg of msgs">{{msg}}</p>
        </div>
    </div>
</div>
    `
})
class NetworkTracingTestUi {

    url: string = "https://www.baidu.com";

    msgs: string[] = [];

    addJob(url: string): Promise<any> {
        // just a stub
        return null;
    }

    onProcess(msg: string) {
        if (msg.startsWith("open(") && msg.endsWith(")")) {
            const jobId = msg.substring(5, msg.length - 1);
            const viewerUrl = `https://chromedevtools.github.io/timeline-viewer/?loadTimelineFromURL=${document.baseURI}tracing/?id=${jobId}`;
            window.open(viewerUrl, "_blank");
        }
        else {
            this.msgs.push(msg);
        }
    }

}

class NetworkTracingTask {

    @Autowired(NetworkTracingTestUi)
    private networkTracingTestUi: NetworkTracingTestUi;

    @DataUiRequest(NetworkTracingTestUi.prototype.addJob)
    @AddToQueue({
        name: "networkTracing",
        filterType: NoFilter
    })
    addJob(url: string) {
        this.networkTracingTestUi.onProcess(url + " 任务添加成功");
        return url;
    }

    @FromQueue({
        name: "networkTracing",
        workerFactory: PuppeteerWorkerFactory
    })
    async networkTracing(page: Page, job: Job) {
        this.networkTracingTestUi.onProcess(job.url + " 正在打开");
        await PuppeteerUtil.defaultViewPort(page);
        const networkTracing = new NetworkTracing(page);
        await page.goto(job.url);
        const pageRequests = networkTracing.requests();
        pageRequests["_id"] = job._id;
        await appInfo.db.save("networkTracing", pageRequests);
        this.networkTracingTestUi.onProcess(job.url + " NetworkTracing记录成功");
        this.networkTracingTestUi.onProcess("open(" + job._id + ")");
    }

    @RequestMapping("/tracing")
    async getTracingFile(req: Request, res: Response) {
        const pageRequests = await appInfo.db.findById("networkTracing", req.query.id);
        const traceEvents = NetworkTracing.requestsToTraceEvents(pageRequests);
        const traceEventsStr = JSON.stringify(traceEvents);
        res.header("Access-Control-Allow-Origin", "https://chromedevtools.github.io");
        res.header("Access-Control-Allow-Credentials", "true");
        res.header("Access-Control-Allow-Headers", "Content-Type,X-Requested-With");
        res.header("Access-Control-Allow-Methods","GET,OPTIONS");
        res.header('Content-Type', "text/plain; charset=utf-8");
        res.write(traceEventsStr, 'utf-8');
        res.end();
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        NetworkTracingTask
    ],
    dataUis: [
        NetworkTracingTestUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {}
