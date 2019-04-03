import {
    AddToQueue,
    appInfo,
    DataUi,
    DataUiRequest,
    DateUtil,
    DefaultJob,
    FileUtil,
    FromQueue,
    getBean,
    Job,
    Launcher,
    NoFilter,
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
    margin-top: 12px;
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
                        <option [ngValue]="false">第一屏幕</option>
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
                <button *ngIf="screenshotResult && screenshotResult.imgs.length == screenshotResult.total" (click)="doExport()" class="btn btn-primary" style="margin-left: 32px">Export</button>
            </form>
        </div>
        <div class="col-sm-9">
            <div *ngIf="screenshotResult" class="progress">
                <div class="progress-bar progress-bar-info" role="progressbar" [attr.aria-valuenow]="progress" aria-valuemin="0" aria-valuemax="100" [style.width.%]="progress">
                    {{progress}}%
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

    url: string;

    fullPage: boolean = true;

    saveType: string = "png";

    screenshotResult;

    progress = 0;

    screenshot(url: string, fullPage?: boolean, saveType?: string) {
        // just a stub
        return null;
    }

    doScreenshot() {
        this.screenshot(this.url, this.fullPage, this.saveType).then(res => {
        });
    }

    onScreenshotRes(screenshotRes: any) {
        this.progress = parseInt("" + screenshotRes.imgs.length / screenshotRes.total * 100);
        this.screenshotResult = screenshotRes;
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
            const canvasArr = [];
            const ctxArr = [];
            const mergeMax = 25; // 最多将 25 张图片合成一个，再大一点就会报错
            for (let i = 0, len = imgs.length;  i < len; i++) {
                if (i % mergeMax == 0) {
                    const canvas = document.createElement("canvas");
                    canvas.width = 1920;
                    canvas.height = 1080 * Math.min(mergeMax, len - i);
                    canvasArr.push(canvas);

                    const ctx = canvas.getContext("2d");
                    ctxArr.push(ctx);
                }
                ctxArr[ctxArr.length - 1].drawImage(imgs[i], 0, 1080 * (i % mergeMax), 1920, 1080);
                if (i % mergeMax == (mergeMax - 1) || i == len - 1) {
                    canvasArr[canvasArr.length - 1].toBlob(blob => this.downloadBlob(blob,
                        this.screenshotResult.id + "_" + (i / mergeMax).toFixed() + "."  + this.screenshotResult.saveType));
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

}

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
        workerFactory: PuppeteerWorkerFactory,
        timeout: -1
    })
    async screenshot(page: Page, job: Job) {
        await page.setViewport({
            width: 1920,
            height: 1080
        });
        await page.goto(job.url());

        const maxH = await page.evaluate(() => document.body.offsetHeight);
        await page.setViewport({
            width: 1920,
            height: 1080 * 1000
        });

        FileUtil.mkdirs(appInfo.workplace + "/screenshot");

        let pageNum;
        if (job.datas().fullPage) {
            pageNum = parseInt("" + (maxH - 1) / 1080) + 1;
        }
        else {
            pageNum = 1;
        }

        const saveType = job.datas().saveType;
        const screenshotRes = {
            id: job.id(),
            imgs: [],
            saveType: saveType,
            total: pageNum
        };
        for (let i = 0; i < pageNum; i++) {
            if (i > 0) {
                await page.evaluate(y => new Promise(resolve => {
                    document.body.style.marginTop = "-" + y + "px";
                    setTimeout(resolve, 1000 / 60);
                }), 1080 * i);
            }
            const time = DateUtil.toStr(new Date(), "YYYYMMDD_HHmmss");
            const savePath = "/screenshot/" + time + "_" + i + "." + saveType;
            await page.screenshot({
                path: appInfo.workplace + savePath,
                type: job.datas().saveType,
                clip: {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080
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
            devtools: true
        })
    ],
    webUiPort: 9000
})
class App {}
