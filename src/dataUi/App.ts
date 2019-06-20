import {
    appInfo,
    DataUi,
    DataUiRequest,
    DefaultQueue,
    FromQueue,
    getBean,
    Job,
    Launcher,
    NoFilter,
    PuppeteerUtil,
    PuppeteerWorkerFactory,
    ViewEncapsulation,
    Page
} from "ppspider";

declare const CodeMirror: any;

@DataUi({
    label: "动态任务(DataUi 演示)",
    encapsulation: ViewEncapsulation.None,
    // language=CSS
    style: `
#dynamicJobUi .CodeMirror {
    height: auto;
}

#evaluateJsWrapper .CodeMirror {
    height: 400px;
}

#resultViewer {
    overflow-y: auto;
    max-height: calc(100vh - 90px);
    margin-top: 18px;
}
    `,
    // language=Angular2HTML
    template: `
<div id="dynamicJobUi" class="container-fluid" style="margin-top: 12px">
    <div class="row">
        <div class="col-sm-3">
            <form>
                <div class="form-group">
                    <label for="url">Url</label>
                    <input [(ngModel)]="url" id="url" name="url" class="form-control">
                </div>
                <div id="evaluateJsWrapper" class="form-group">
                    <label for="evaluateJs">Evaluate Js</label>
                    <textarea id="evaluateJs" name="evaluateJs" class="form-control">{{defaultEvaluateJs}}</textarea>
                </div>
                <button (click)="doAddJob()" [disabled]="url && evaluateJs ? null : true" class="btn btn-primary">
                    Submit
                </button>
            </form>
        </div>
        <div class="col-sm-9">
            <div id="resultViewer" class="panel-group" role="tablist" aria-multiselectable="true">
                <div *ngFor="let job of jobs" class="panel panel-default">
                    <div 
                        [attr.id]="'jobHeading_' + job.id"
                        class="panel-heading" role="tab">
                        <h5 class="panel-title">
                            <a role="button" data-toggle="collapse" 
                                data-parent="#resultViewer" 
                                [attr.href]="'#jobPanel_' + job.id"
                                [attr.aria-controls]="'jobPanel_' + job.id"
                                aria-expanded="false">
                                Job#{{job.id}}
                            </a>
                        </h5>
                    </div>
                    <div 
                        [attr.id]="'jobPanel_' + job.id" 
                        [attr.aria-labelledby]="'jobHeading_' + job.id"
                        class="panel-collapse collapse in" role="tabpanel">
                        <div class="panel-body">
                            <form>
                                <div class="form-group">
                                    <label>Url</label>
                                    <a class="form-control">{{job.url}}</a>
                                </div>
                                <div class="form-group">
                                    <label>Evaluate Js</label>
                                    <textarea #evaluateJsTA [attr.id]="initEvaluateJsTA(evaluateJsTA, job)" class="form-control"></textarea>
                                </div>
                                <div class="form-group">
                                    <label>Result</label>
                                    <div #resultDiv [attr.id]="initResultDiv(resultDiv, job)"></div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
    `
})
class DynamicJobUi {

    // language=JavaScript
    readonly defaultEvaluateJs =
`(() => {
    const res = {
        title: $("title").text(),
        urls: []
    };
    $("a").each((index, ele) => {
        const href = ele.href;
        if (href.startsWith("http")) {
            res.urls.push(href);
        }
    });
    return res;
})
`;

    url: string = "https://www.baidu.com";

    evaluateJs: string = this.defaultEvaluateJs;

    jobs: {
        id: string,
        url: string,
        evaluateJs: string,
        result?: any,
        evaluateJsInit?: boolean,
        resultInit?: boolean
    }[] = [];

    ngAfterViewInit() {
        const evaluateJsInput = CodeMirror.fromTextArea(document.getElementById("evaluateJs"), {
            matchBrackets: true,
            autoCloseBrackets: true,
            mode: "application/javascript",
            lineWrapping: true,
            lineNumbers: true,
            lineHeight: "20px",
            // readOnly: "nocursor"
        });
        evaluateJsInput.on('change', (cm, change) => {
            evaluateJsInput.display.wrapper.style.border = "1px solid #e6e6e6";
            const value = cm.getValue();
            try {
                const fun = eval(value);
                if (typeof fun === "function") {
                    this.evaluateJs = value;
                    return;
                }
            }
            catch (e) {
            }
            this.evaluateJs = null;
            evaluateJsInput.display.wrapper.style.border = "1px solid #ff490d";
        });
    }

    doAddJob() {
        this.addJob(this.url, this.evaluateJs).then(res => {
            this.jobs.push(res);
        });
    }

    addJob(url: string, evaluateJs: string): Promise<any> {
        // just a stub
        return null;
    }

    asyncJobResult(res: {
        id: string,
        url: string,
        evaluateJs: string,
        result: any
    }) {
        const localJob = this.jobs.find(item => item.id === res.id);
        if (localJob) {
            Object.assign(localJob, res);
        }
        else {
            this.jobs.push(res);
        }
    }

    initEvaluateJsTA(evaluateJsTA, job) {
        if (!evaluateJsTA.id) {
            evaluateJsTA.id = "evaluateJs_" + job.id;
            $("#jobHeading_" + job.id + " a").trigger("click");
            const editor = CodeMirror.fromTextArea(evaluateJsTA, {
                matchBrackets: true,
                autoCloseBrackets: true,
                mode: "application/javascript",
                lineWrapping: true,
                lineNumbers: true,
                lineHeight: "20px",
                readOnly: "nocursor"
            });
            editor.setValue(job.evaluateJs);
            editor.refresh();
        }
        return evaluateJsTA.id;
    }

    initResultDiv(resultDiv, job) {
        if (!resultDiv.id && job.result !== undefined) {
            resultDiv.id = "resultDiv_" + job.id;
            if (typeof job.result === "object") {
                ($(resultDiv) as any).jsonViewer(job.result, { collapsed: false });
                $(resultDiv).find("a.json-string").attr("target", "_blank");
            }
            else {
                $(resultDiv).append(`<textarea id='resultTA_${job.id}'></textarea>`);
                const editor = CodeMirror.fromTextArea(document.getElementById("resultTA_" + job.id), {
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    mode: "text/plain",
                    lineWrapping: true,
                    lineNumbers: true,
                    lineHeight: "20px",
                    readOnly: "nocursor"
                });
                editor.setValue(job.result);
                editor.refresh();
            }
        }
        return resultDiv.id;
    }

}

class TestTask {

    @DataUiRequest(DynamicJobUi.prototype.addJob)
    addDynamicJob(url: string, evaluateJs: string) {
        const job = new Job(url);
        job.datas = {
            evaluateJs: evaluateJs
        };
        appInfo.queueManager.addToQueue(null, {
            queueName: "dynamic",
            jobs: job,
            filterType: NoFilter,
            queueType: DefaultQueue
        });
        return {
            id: job._id,
            url: url,
            evaluateJs: evaluateJs
        };
    }

    @FromQueue({
        name: "dynamic"
    })
    async dynamicJob(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);
        const fun = eval(job.datas.evaluateJs);
        const result = await page.evaluate(fun);
        getBean(DynamicJobUi).asyncJobResult({
            id: job._id,
            url: job.url,
            evaluateJs: job.datas.evaluateJs,
            result: result
        });
    }

}

@Launcher({
    workplace: "workplace",
    tasks: [
        TestTask
    ],
    dataUis: [
        DynamicJobUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {}
