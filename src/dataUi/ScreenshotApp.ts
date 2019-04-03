import {
    AddToQueue,
    appInfo,
    Bean,
    DataUi,
    DataUiRequest,
    DateUtil,
    DefaultJob, FileUtil,
    FromQueue,
    getBean,
    Job,
    Launcher,
    NoFilter,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

@DataUi({
    label: "网页截图工具",
    // language=CSS
    style: `
#screenshotViewer {
    display: block;
    overflow-y: auto;
    height: calc(100vh - 90px);
    margin-top: 18px;
}

#screenshotViewer img {
    display: block;
    position: relative;
    max-width: 100%;
    margin: 0 auto;
}
    `,
    // language=Angular2HTML
    template: `
<div class="container-fluid" style="margin-top: 12px">
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
                        <option [ngValue]="false">当前屏幕</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="saveType">保存格式</label>
                    <select [(ngModel)]="saveType" id="saveType" name="saveType" class="form-control">
                        <option [ngValue]="'png'">png</option>
                        <option [ngValue]="'jpeg'">jpeg</option>
                    </select>
                </div>
                <button (click)="doScreenshot()" [disabled]="url ? null : true" class="btn btn-primary">Submit</button>
            </form>
        </div>
        <div class="col-sm-9">
            <div id="screenshotViewer">
                <img *ngIf="screenshotResult" [src]="screenshotResult">
            </div>
        </div>
    </div>
</div>
    `
})
export class ScreenshotHelperUi {

    url: string;

    fullPage: boolean = true;

    saveType: string = "png";

    screenshotResult: string;

    screenshot(url: string, fullPage?: boolean, saveType?: string) {
        // just a stub
        return null;
    }

    doScreenshot() {
        this.screenshot(this.url, this.fullPage, this.saveType).then(res => {
        });
    }

    onScreenshotRes(job: any) {
        this.screenshotResult = job._datas.savePath;
    }

}

@Bean()
class ScreenshotTask {

    @DataUiRequest(ScreenshotHelperUi.prototype.screenshot)
    @AddToQueue({
        name: "screenshot",
        filterType: NoFilter
    })
    async addScreenshotJob(url: string, fullPage?: boolean, saveType?: "png" | "jpeg") {
        const job = new DefaultJob(url);
        job.datas({
            fullPage: !!fullPage,
            saveType: saveType || "png"
        });
        return job;
    }

    @FromQueue({
        name: "screenshot",
        workerFactory: PuppeteerWorkerFactory
    })
    async screenshot(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await page.goto(job.url());
        const saveName = DateUtil.toStr(new Date(), "YYYYMMDD_HHmmss") + "." + job.datas().saveType;
        FileUtil.mkdirs(appInfo.workplace + "/screenshot");
        await page.screenshot({
            path: appInfo.workplace + "/screenshot/" + saveName,
            type: job.datas().saveType,
            fullPage: job.datas().fullPage
        });
        job.datas().savePath = "/screenshot/" + saveName;
        getBean(ScreenshotHelperUi).onScreenshotRes(job);
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
            devtools: true
        })
    ],
    webUiPort: 9000
})
class App {}
