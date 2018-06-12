import {appInfo, Job, OnStart, PuppeteerUtil, PuppeteerWorkerFactory} from "ppspider";
import {Page} from "puppeteer";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    async index(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);

        await PuppeteerUtil.setImgLoad(page, false);

        const hisResWait = PuppeteerUtil.onceResponse(page, "https://www.baidu.com/his\\?.*", async response => {
            const resStr = await response.text();
            console.log(resStr);
            const resJson = PuppeteerUtil.jsonp(resStr);
            console.log(resJson);
        });

        await page.goto("http://www.baidu.com");
        await PuppeteerUtil.addJquery(page);
        console.log(await hisResWait);

        const downloadImgRes = await PuppeteerUtil.downloadImg(page, ".index-logo-src", appInfo.workplace + "/download/img");
        console.log(downloadImgRes);

        const href = await PuppeteerUtil.links(page, {
            "index": ["#result_logo", ".*"],
            "baidu": "^https?://[^/]*\\.baidu\\.",
            "other": (a: Element) => {
                const href = (a as any).href as string;
                if (href.startsWith("http")) return href;
            }
        });
        console.log(href);

        const count = await PuppeteerUtil.count(page, "#result_logo");
        console.log(count);
    }

}