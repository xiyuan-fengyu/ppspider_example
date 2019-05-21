import {
    AddToQueue,
    appInfo,
    DataUi,
    DataUiRequest,
    DateUtil,
    FileUtil,
    FromQueue,
    getBean,
    Job,
    JobStatus,
    Launcher,
    NedbDao,
    NoFilter,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";
import * as fs from "fs";

declare const CodeMirror: any;

type ScreenshotConfig = {
    url: string,
    fullPage?: boolean,
    preScroll?: boolean,
    evaluateJs?: string,
    saveType?: "png" | "jpeg"
}

@DataUi({
    label: "网页截图工具",
    // language=CSS
    style: `  
    #screenshotViewer {
        display: block;
        overflow-y: auto;
        height: calc(100vh - 90px);
        margin-top: 12px;
    }

    #screenshotViewer img {
        display: block;
        position: relative;
        max-width: 100%;
        margin: 0 auto;
    }

    .screenshotHistories {
        max-height: 150px;
        overflow-y: auto;
        cursor: pointer;
        word-break: break-all;
    }

    .deleteScreenshotHis {
        position: absolute;
        top: 4px;
        right: 6px;
        color: #cccccc;
    }

    .deleteScreenshotHis:hover {
        color: #ff6356;
    }

    .deleteScreenshotHis, .deleteScreenshotHis:active, .deleteScreenshotHis:focus {
        outline: none;
    }      `,
    // language=Angular2HTML
    template: `
    <div class="container-fluid" style="margin-top: 8px">
        <div class="row">
            <div class="col-sm-3">
                <form>
                    <div class="form-group">
                        <label for="url">Url</label>
                        <input [(ngModel)]="url" id="url" name="url" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="fullPage">截取范围</label>
                        <select [(ngModel)]="fullPage" id="fullPage" name="fullPage" class="form-control">
                            <option [ngValue]="true">整个网页</option>
                            <option [ngValue]="false">第一屏幕</option>
                        </select>
                    </div>
                    <div class="checkbox">
                        <label>
                            <input [(ngModel)]="preScroll" name="preScroll" type="checkbox"> 预先滚动一遍
                        </label>
                    </div>
                    <div class="form-group">
                        <label>截图前执行Js脚本(可使用jQuery)</label>
                        <textarea #evaluateJsTA [attr.id]="initEvaluateJsTA(evaluateJsTA)" class="form-control"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="saveType">保存格式</label>
                        <select [(ngModel)]="saveType" id="saveType" name="saveType" class="form-control">
                            <option [ngValue]="'png'">png</option>
                            <option [ngValue]="'jpeg'">jpeg</option>
                        </select>
                    </div>
                    <button (click)="doScreenshot()" [disabled]="url && evaluateJs !== 'ERROR' ? null : true" class="btn btn-primary">Submit</button>
                    <button *ngIf="screenshotResult && screenshotResult.imgs.length == screenshotResult.total" (click)="doExport()" class="btn btn-primary" style="margin-left: 32px">Export</button>
                </form>
                <form *ngIf="screenshotHistories && screenshotHistories.length" style="margin-top: 4px">
                    <div class="form-group">
                        <label>历史记录</label>
                        <ul class="screenshotHistories list-group">
                            <li *ngFor="let job of screenshotHistories" (click)="screenshotInfo(job)" class="list-group-item">
                                <span>{{job._id}}</span><br/>
                                <a [attr.href]="job.url" target="_blank">{{job.url}}</a>
                                <button (click)="doDeleteScreenshotHis(job._id)" type="button" class="close deleteScreenshotHis">
                                    <span aria-hidden="true">×</span>
                                </button>
                            </li>
                        </ul>
                    </div>
                </form>
            </div>
            <div class="col-sm-9">
                <div *ngIf="screenshotResult" class="progress">
                    <div class="progress-bar progress-bar-info" role="progressbar" [attr.aria-valuenow]="progress" aria-valuemin="0" aria-valuemax="100" [style.width.%]="progress">
                        {{screenshotResult.imgs.length + ' / ' + screenshotResult.total}}
                    </div>
                </div>
                <div id="screenshotViewer">
                    <ng-container *ngIf="screenshotResult">
                        <img *ngFor="let item of screenshotResult.imgs" [src]="item">
                    </ng-container>
                </div>
            </div>
        </div>
    </div>
    `
})
export class ScreenshotHelperUi {

    // language=JavaScript
    readonly defaultEvaluateJs =
`(() => {

})
`;

    evaluateJsEditor: any;

    url: string;

    fullPage: boolean = true;

    preScroll: boolean = false;

    evaluateJs: string = null;

    saveType: string = "png";

    screenshotResult;

    private curJobId: string;

    progress = 0;

    screenshotHistories: any[];

    ngOnInit() {
        this.doLoadScreenshotHistory();
    }

    initEvaluateJsTA(evaluateJsTA) {
        if (!evaluateJsTA.id) {
            evaluateJsTA.id = "evaluateJs";
            const editor = CodeMirror.fromTextArea(evaluateJsTA, {
                matchBrackets: true,
                autoCloseBrackets: true,
                mode: "application/javascript",
                lineWrapping: true,
                lineNumbers: true,
                lineHeight: "20px"
            });
            editor.on('change', (cm, change) => {
                editor.display.wrapper.style.border = "1px solid #e6e6e6";
                const value = cm.getValue();
                if (value === "") {
                    this.evaluateJs = null;
                }
                else {
                    try {
                        const fun = eval(value);
                        if (typeof fun === "function") {
                            this.evaluateJs = value;
                            return;
                        }
                    }
                    catch (e) {
                    }
                    this.evaluateJs = "ERROR";
                    editor.display.wrapper.style.border = "1px solid #ff490d";
                }
            });
            editor.setValue(this.defaultEvaluateJs);
            editor.refresh();
            this.evaluateJsEditor = editor;
        }
        return evaluateJsTA.id;
    }

    screenshot(params: ScreenshotConfig) {
        // just a stub
        return null;
    }

    loadScreenshotHistory() {
        // just a stub
        return null;
    }

    loadScreenshotInfo(job) {
        // just a stub
        return null;
    }

    deleteScreenshotHis(jobId: string) {
        // just a stub
        return null;
    }

    doLoadScreenshotHistory() {
        this.loadScreenshotHistory().then(res => {
            this.screenshotHistories = res;
        });
    }

    doScreenshot() {
        this.screenshot({
            url: this.url,
            fullPage: this.fullPage,
            preScroll: this.preScroll,
            evaluateJs: this.evaluateJs,
            saveType: this.saveType
        } as any).then(res => {
            this.curJobId = res._id;
        });
    }

    onScreenshotRes(screenshotRes: any) {
        if (screenshotRes.id == this.curJobId) {
            this.progress = parseInt("" + screenshotRes.imgs.length / screenshotRes.total * 100);
            this.screenshotResult = screenshotRes;
        }
        this.doLoadScreenshotHistory();
    }

    screenshotInfo(job) {
        const data = job.datas;
        this.url = data.url;
        this.fullPage = data.fullPage;
        this.preScroll = data.preScroll;
        this.evaluateJsEditor.setValue(data.evaluateJs);
        this.evaluateJsEditor.refresh();

        this.loadScreenshotInfo(job).then(res => {
            this.curJobId = res.id;
            this.onScreenshotRes(res);
        });
    }

    doDeleteScreenshotHis(jobId: string) {
        this.deleteScreenshotHis(jobId).then(res => {
            this.doLoadScreenshotHistory();
        });
    }

    doExport() {
        const imgLoadPs = [];
        for (let imgSrc of this.screenshotResult.imgs) {
            imgLoadPs.push(new Promise(resolve => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = imgSrc;
            }));
        }
        Promise.all(imgLoadPs).then(imgs => {
            const mergeMax = 25; // 最多将 25 张图片合成一个，再大一点就会报错
            const imgsLen = imgs.length;
            let fromI = 0;
            let toI = Math.min(mergeMax, imgsLen);
            while (toI <= imgsLen) {
                let height = (toI - fromI - 1) * 1080 + imgs[toI - 1].height;

                const canvas = document.createElement("canvas");
                canvas.width = 1920;
                canvas.height = height;
                const ctx = canvas.getContext("2d");

                for (let i = fromI; i < toI; i++) {
                    const img = imgs[i];
                    ctx.drawImage(img, 0, 1080 * (i - fromI), 1920, img.height);
                }

                const curSaveI = (fromI / mergeMax).toFixed();
                canvas.toBlob(blob => this.downloadBlob(blob,
                    this.screenshotResult.id + "_" + curSaveI + "."  + this.screenshotResult.saveType));

                if (toI == imgsLen) {
                    break;
                }
                else {
                    fromI = toI;
                    toI = Math.min(toI + mergeMax, imgsLen);
                }
            }
        });
    }

    downloadBlob(blob: Blob, file: string) {
        const url= (window.URL || window["webkitURL"]).createObjectURL(blob);
        const a = document.createElement("a") as any;
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = file;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    onError(msg: string) {
        alert("页面打开失败：" + msg);
    }

}

class ScreenshotTask {

    /**
     * 添加截图任务
     * @param params
     */
    @DataUiRequest(ScreenshotHelperUi.prototype.screenshot)
    @AddToQueue({
        name: "screenshot",
        filterType: NoFilter
    })
    async addScreenshotJob(params: ScreenshotConfig) {
        const job = new Job(params.url);
        const jobData = {
            _: {
                maxTry: 1
            }
        };
        Object.assign(jobData, params);
        job.datas = jobData;
        return job;
    }

    /**
     * 加载截图历史记录
     */
    @DataUiRequest(ScreenshotHelperUi.prototype.loadScreenshotHistory)
    async loadScreenshotHistory() {
        return appInfo.db.findList("job", {
            queue: "screenshot",
            status: JobStatus.Success
        }, null, {
            createTime: -1
        });
    }

    /**
     * 加载截图历史记录详情
     */
    @DataUiRequest(ScreenshotHelperUi.prototype.loadScreenshotInfo)
    async loadScreenshotInfo(job: any) {
        const screenshotRes = job.datas;
        screenshotRes.id = job._id;
        screenshotRes.imgs = [];
        const files = fs.readdirSync(appInfo.workplace + "/screenshot");
        const fileIndexRegex = /.*_(\d+)\.(png|jpeg)$/;
        for (let file of files) {
            if (file.startsWith(screenshotRes.id + "_")) {
                screenshotRes.imgs.push({
                    file: "/screenshot/" + file,
                    index: parseInt(fileIndexRegex.exec(file)[1])
                });
            }
        }
        screenshotRes.imgs = screenshotRes.imgs.sort((o1, o2) => o1.index - o2.index)
            .map(item => item.file);
        screenshotRes.total = screenshotRes.imgs.length;
        return screenshotRes;
    }

    /**
     * 删除截图历史记录
     */
    @DataUiRequest(ScreenshotHelperUi.prototype.deleteScreenshotHis)
    async deleteScreenshotHis(jobId: string) {
        const files = fs.readdirSync(appInfo.workplace + "/screenshot");
        for (let file of files) {
            if (file.startsWith(jobId + "_")) {
                fs.unlinkSync(appInfo.workplace + "/screenshot/" + file);
            }
        }
        return appInfo.db.remove("job", {
            _id: jobId
        }, false);
    }

    /**
     * 执行截图任务
     * @param page
     * @param job
     */
    @FromQueue({
        name: "screenshot",
        workerFactory: PuppeteerWorkerFactory,
        timeout: -1
    })
    async screenshot(page: Page, job: Job) {
        FileUtil.mkdirs(appInfo.workplace + "/screenshot");

        const jobData = job.datas as ScreenshotConfig;
        const screenshotRes = {
            id: job._id,
            imgs: [],
            saveType: jobData.saveType,
            total: 1
        };
        getBean(ScreenshotHelperUi).onScreenshotRes(screenshotRes);

        await page.setViewport({
            width: 1920,
            height: 1080
        });
        try {
            await page.goto(job.url, { waitUntil: 'networkidle0' });
        }
        catch (e) {
            getBean(ScreenshotHelperUi).onError(e.message);
            throw e;
        }

        if (jobData.preScroll) {
            // 预先滚动一遍，加载数据
            await PuppeteerUtil.scrollToBottom(page, -1, 60, 108);
            // 滚动到顶部
            await page.evaluate(() => window.scrollTo(0, 0));
        }

        if (jobData.evaluateJs) {
            // 执行脚本
            await PuppeteerUtil.addJquery(page);
            const fun = eval(jobData.evaluateJs);
            await page.evaluate(fun);
        }

        const maxH = await page.evaluate(() => {
            const h = document.documentElement.scrollHeight;
            document.documentElement.style.height = h + "px";
            return h;
        });

        let pageNum;
        if (jobData.fullPage) {
            pageNum = parseInt("" + (maxH - 1) / 1080) + 1;
        }
        else {
            pageNum = 1;
        }
        screenshotRes.total = pageNum;

        // 隐藏滚动条
        await page.evaluate(() => {
            document.documentElement.style.overflowY = "hidden";
            document.body.style.overflowY = "hidden";
        });

        for (let i = 0; i < pageNum; i++) {
            if (i > 0) {
                await page.evaluate(y => new Promise(resolve => {
                    document.documentElement.style.transform = `translate(0, -${y}px)`;
                    setTimeout(resolve, 1000 / 60);
                }), 1080 * i);
            }
            const savePath = "/screenshot/" + screenshotRes.id + "_" + i + "." + jobData.saveType;
            await page.screenshot({
                path: appInfo.workplace + savePath,
                type: jobData.saveType,
                omitBackground: true,
                clip: {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: Math.min(1080, maxH - 1080 * i)
                }
            });

            screenshotRes.imgs.push(savePath);
            getBean(ScreenshotHelperUi).onScreenshotRes(screenshotRes);
        }
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    tasks: [
        ScreenshotTask
    ],
    dataUis: [
        ScreenshotHelperUi
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: false
        })
    ],
    webUiPort: 9000
})
class App {}
