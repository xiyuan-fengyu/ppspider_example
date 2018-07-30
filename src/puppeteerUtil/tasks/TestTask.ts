import {appInfo, Job, logger, OnStart, PuppeteerUtil, PuppeteerWorkerFactory} from "ppspider";
import {Page} from "puppeteer";

export class TestTask {

    @OnStart({
        urls: "http://www.baidu.com",
        workerFactory: PuppeteerWorkerFactory
    })
    async index(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);

        // @TODO 2018-07-30 目前 puppeteer 存在 bug，导致 reponse 丢失
        // await PuppeteerUtil.setImgLoad(page, false);

        const hisResWait = PuppeteerUtil.onceResponse(page, "https://www.baidu.com/his\\?.*", async response => {
            const resStr = await response.text();
            logger.debug(resStr);
            const resJson = PuppeteerUtil.jsonp(resStr);
            logger.debug(JSON.stringify(resJson, null, 4));
        });

        await page.goto("http://www.baidu.com");
        // logger.debug(JSON.stringify(await hisResWait, null, 4));

        await PuppeteerUtil.addJquery(page);
        await PuppeteerUtil.scrollToBottom(page, 5000, 100, 1000);

        const downloadImgRes = await PuppeteerUtil.downloadImg(page, ".index-logo-src", appInfo.workplace + "/download/img");
        logger.debug(JSON.stringify(await downloadImgRes, null, 4));

        const href = await PuppeteerUtil.links(page, {
            "index": ["#result_logo", ".*"],
            "baidu": "^https?://[^/]*\\.baidu\\.",
            "other": (a: Element) => {
                const href = (a as any).href as string;
                if (href.startsWith("http")) return href;
            }
        });
        logger.debug(href);

        const count = await PuppeteerUtil.count(page, "#result_logo");
        logger.debug("" + count);

        const ids = await PuppeteerUtil.specifyIdByJquery(page, "a:visible:contains('登录')");
        if (ids) {
            logger.debug(JSON.stringify(ids, null, 4));
            await page.tap("#" + ids[0]);
        }
    }

}