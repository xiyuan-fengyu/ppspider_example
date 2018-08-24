import {
    AddToQueue,
    AddToQueueData, appInfo, FileUtil,
    FromQueue,
    Job,
    JobOverride,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

export class BilibiliTask {

    @JobOverride("video")
    overrideVideoJob(job: Job) {
        const match = job.url().match("/video/av(\\d+).+?([?&]p=(\\d+))?");
        if (match) {
            // 获取av id 和分页信息，组合成新的唯一avId，用于过滤
            const avId = match[1];
            const pNum = match[3] || "0";
            job.key(avId + "_" + pNum);
            job.datas().id = avId;
            job.datas().p = pNum;
        }
    }

    @OnStart({
        urls: "https://www.bilibili.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @AddToQueue([
        {
            name: "video"
        },
        {
            name: "other"
        }
    ])
    @FromQueue({
        name: "other",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000
    })
    async roam(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());
        await PuppeteerUtil.scrollToBottom(page);
        return await PuppeteerUtil.links(page, {
            video: ".*bilibili.*/video/av.*",
            other: ".*bilibili.*"
        });
    }

    // @OnStart({
    //     urls: "https://www.bilibili.com/video/av30025082/",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    @AddToQueue([
        {
            name: "video"
        },
        {
            name: "other"
        }
    ])
    @FromQueue({
        name: "video",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000
    })
    async video(page: Page, job: Job): AddToQueueData {
        const id = job.datas().id;
        const p = job.datas().p;
        const dataDir = appInfo.workplace + "/data/video/" + id + "/" + p;

        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        // 抓取视频的统计量 https://api.bilibili.com/x/web-interface/archive/stat?aid=24716572
        const countResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/web-interface/archive/stat", async response => {
            const counts = await response.text();// 这个接口直接返回的json数据
            FileUtil.write(dataDir + "/counts.json", counts);
        });

        // 抓取标签信息
        const tagsResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/tag/archive/tags", async response => {
            const tags = PuppeteerUtil.jsonp(await response.text());
            FileUtil.write(dataDir + "/tags.json", JSON.stringify(tags));
        });

        // 抓取相关视频列表
        const relatedResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/web-interface/archive/related", async response => {
            const related = PuppeteerUtil.jsonp(await response.text());
            FileUtil.write(dataDir + "/related.json", JSON.stringify(related));
        });

        // 首页评论 https://api.bilibili.com/x/v2/reply?callback=jQuery1720058644763414575474_1528964903573&jsonp=jsonp&pn=1&type=1&oid=24716572&sort=0&_=1528964941762
        const replyResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/v2/reply", async response => {
            const reply = PuppeteerUtil.jsonp(await response.text());
            FileUtil.write(dataDir + "/reply/1.json", JSON.stringify(reply));
        });

        await page.goto(job.url());
        await PuppeteerUtil.scrollToBottom(page);
        await countResWait;
        await tagsResWait;
        await relatedResWait;

        // 加载jquery;
        await PuppeteerUtil.addJquery(page);

        // 抓取该视频基本信息
        const videoInfo: any = await page.evaluate(() => {
            const tempVideoInfo: any = {};
            const $viewbox_report = $("#viewbox_report");
            tempVideoInfo.title = $viewbox_report.find("h1:eq(0) span").text();
            tempVideoInfo.classification = $viewbox_report.find(".tminfo .crumb").text().split(" > ");
            tempVideoInfo.time = $viewbox_report.find(".tminfo time").text();

            const userA = $("#v_upinfo a[report-id='name']");
            const userAHref = (userA[0] as any).href;
            tempVideoInfo.user = {
                id: userAHref.substring(userAHref.lastIndexOf("/") + 1),
                name: userA.text()
            };
            tempVideoInfo.desc = $("#v_desc .info").text();
            return tempVideoInfo;
        });
        videoInfo.id = id;
        videoInfo.p = p;
        FileUtil.write(dataDir + "/info.json", JSON.stringify(videoInfo));

        // 抓取前两页的评论
        await page.waitForSelector("#comment .comment-list .list-item.reply-wrap");
        await this.crawlReply(page, dataDir, 1, replyResWait);
        await this.crawlReply(page, dataDir, 2, null);

        return await PuppeteerUtil.links(page, {
            video: ".*bilibili.*/video/av.*",
            other: ".*bilibili.*"
        });
    }

    private async crawlReply(page: Page, dataDir: string, pageIndex: number, replyResWait: Promise<any>) {
        if (pageIndex == 1) {
            if (replyResWait) await replyResWait;
        }
        else {
            // 点击换页，并监听接口返回结果
            const pageBtnId = await PuppeteerUtil.specifyIdByJquery(page,
                `#comment .bottom-page.paging-box-big a:contains('${pageIndex}')`);
            if (!pageBtnId) return;

            replyResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/v2/reply", async response => {
                const reply = PuppeteerUtil.jsonp(await response.text());
                FileUtil.write(dataDir + "/reply/" + pageIndex + ".json", JSON.stringify(reply));
            });
            page.tap("#" + pageBtnId[0]);
            await replyResWait;
        }

        // 点击楼中楼的更多回复，抓取所有分页回复
        // 获取当前页所有主楼回复id
        const replyIds: string[] = await page.evaluate(() => {
            const ids = [];
            $("#comment .comment-list .list-item.reply-wrap").each((index, div) => {
               ids[$(div).attr("data-id")] = true;
            });
            return Object.keys(ids);
        });

        for (let replyId of replyIds) {
            // 检查是否有 “点击查看” 按钮
            const btnMoreSelector = await page.evaluate((replyId) => {
                const selector = `#comment .comment-list .list-item.reply-wrap[data-id='${replyId}'] a.btn-more`;
                const btnMoreA = $(selector);
                if (btnMoreA.length) {
                    return selector;
                }
            }, replyId);

            if (btnMoreSelector) {
                // 抓取所有楼中楼回复
                let subReplyPageIndex = 1;
                while (true) {
                    let tapSelector;
                    if (subReplyPageIndex == 1) tapSelector = btnMoreSelector;
                    else {
                        const nextASelector = `#comment .comment-list .list-item.reply-wrap[data-id='${replyId}'] .paging-box a.next`;
                        const nextACount = await PuppeteerUtil.count(page, nextASelector);
                        if (nextACount > 0) tapSelector = nextASelector;
                    }

                    if (!tapSelector) break;
                    else {
                        const subReplyResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/v2/reply", async response => {
                            const reply = PuppeteerUtil.jsonp(await response.text());
                            FileUtil.write(dataDir + "/reply/sub_" + replyId + "_" + subReplyPageIndex + ".json", JSON.stringify(reply));
                        });
                        page.tap(tapSelector);
                        await subReplyResWait;
                        subReplyPageIndex++;
                    }
                }
            }
        }
    }

}