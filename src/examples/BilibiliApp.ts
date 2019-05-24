import {
    AddToQueue,
    AddToQueueData,
    appInfo,
    FromQueue,
    Job,
    JobOverride,
    Launcher,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";

/**
 * 抓取 https://www.bilibili.com/ 视频信息和评论
 */
class BilibiliTask {

    @JobOverride("videos")
    overrideVideoJobKey(job: Job) {
        const match = job.url.match("/video/av(\\d+)");
        if (match) {
            // 获取av id 和分页信息，组合成新的唯一key，用于BloonFilter过滤
            const avId = match[1];
            job.key = avId; // 设置 key，每个视频只抓取 1p
            job.datas.id = parseInt(avId);
        }
    }

    @OnStart({
        urls: "https://www.bilibili.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    // @FromQueue({
    //     name: "others",
    //     workerFactory: PuppeteerWorkerFactory,
    //     exeInterval: 5000,
    //     parallel: 1
    // })
    @AddToQueue([
        { name: "videos" },
        { name: "others" }
    ])
    async roam(page: Page, job: Job): AddToQueueData {
        // await PuppeteerUtil.defaultViewPort(page); // 设置分辨率 1920 * 1080
        // await PuppeteerUtil.setImgLoad(page, false); // 禁用图片加载
        // await page.goto(job.url); // 跳转网页
        // await PuppeteerUtil.scrollToBottom(page); // 滚动到网页底部，以触发所有资源的加载
        // return await PuppeteerUtil.links(page, {
        //     videos: ".*bilibili.*/video/av.*",
        //     others: ".*bilibili.*"
        // });
        return {
            "videos": ["https://www.bilibili.com/video/av53238111/"]
        };
    }

    @FromQueue({
        name: "videos",
        workerFactory: PuppeteerWorkerFactory,
        exeInterval: 5000,
        parallel: 1
    })
    @AddToQueue([
        { name: "videos" },
        { name: "others" }
    ])
    async video(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        const videoInfo: any = {
            _id: job.datas.id
        };

        // 抓取视频的基本信息 https://api.bilibili.com/x/web-interface/view?aid=avId
        const infoResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/web-interface/view", async response => {
            const res = await response.json();
            Object.assign(videoInfo, res.data)
        });

        // 抓取视频的tags
        const tagsResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/tag/archive/tags", async response => {
            videoInfo.tags = PuppeteerUtil.jsonp(await response.text());
        });

        // 抓取相关视频列表
        const relatedResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/web-interface/archive/related", async response => {
            const res = await response.json();
            videoInfo.related = res.data;
        });

        // 第一页评论
        const firstPageReplyResWait = this.createWaitReplyOnce(page);

        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);
        // 如果不支持h5播放器，则不会发起 api.bilibili.com/x/web-interface/view 和 api.bilibili.com/x/web-interface/archive/related 两个请求
        // 我们自己发起这两个请求
        await page.evaluate(avId => {
            $.get(`https://api.bilibili.com/x/web-interface/archive/related?aid=${avId}&jsonp=jsonp`);
            $.get(`https://api.bilibili.com/x/web-interface/view?aid=${avId}`);
        }, job.datas.id);
        await PuppeteerUtil.scrollToBottom(page, 5000, 100, 1000);
        await infoResWait;
        await tagsResWait;
        await relatedResWait;
        await firstPageReplyResWait;

        // 保存视频信息
        await appInfo.db.save("video", videoInfo);

        for (let i = 1; i <= config.maxReplyPageIndex; i++) {
            await this.getPageReplies(page, i);
        }

        return await PuppeteerUtil.links(page, {
            videos: ".*bilibili.*/video/av.*",
            others: ".*bilibili.*"
        });
    }

    private createWaitReplyOnce(page: Page) {
        // https://api.bilibili.com/x/v2/reply/reply?callback=jQuery33106326317261061538_1558689363028&jsonp=jsonp&pn=1&type=1&oid=53238111&ps=10&root=1623919246&_=1558689363031
        return PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/v2/reply(/reply)?\\?", async response => {
            const res = PuppeteerUtil.jsonp(await response.text());
            await this.saveReplies(res.data.replies);
        });
    }

    /**
     * 保存评论和用户信息
     * @param replies
     */
    private saveReplies(replies: any) {
        const waitArr = [];
        if (replies instanceof Array) {
            for (let reply of replies) {
                // 单独存储用户信息
                const member = reply.member;
                delete reply.member;
                member._id = member.mid;
                waitArr.push(appInfo.db.save("member", member));

                // 单独存储楼中楼回复
                const subReplies = reply.replies;
                delete reply.replies;
                if (subReplies) {
                    waitArr.push(this.saveReplies(subReplies));
                }

                // 删除不必要的信息
                delete reply.folder;

                waitArr.push(appInfo.db.save("reply", reply));
            }
        }
        return Promise.all(waitArr);
    }

    /**
     * 主楼切换分页，楼中楼加载更多和切换分页
     * @param page
     * @param pageIndex
     */
    private async getPageReplies(page: Page, pageIndex: number) {
        if (pageIndex == 1) {
            // 第一页的主楼评论在页面加载过程中已经抓取
        }
        else {
            // 点击主楼换页，并监听接口返回结果
            const nextPageBtnId = await PuppeteerUtil.specifyIdByJquery(page,
                `#comment .bottom-page.paging-box-big a:contains('${pageIndex}')`);
            if (!nextPageBtnId) return;

            const mainReplyResWait = this.createWaitReplyOnce(page);
            await page.tap("#" + nextPageBtnId[0]);
            await mainReplyResWait;
        }

        // 点击楼中楼的更多回复，抓取所有分页回复
        // 获取当前页主楼中包含 “点击查看”按钮的楼层id
        const replyIds: string[] = await page.evaluate(() => {
            const ids = {};
            $("#comment .comment-list .list-item.reply-wrap").each((index, div) => {
                const $div = $(div);
                if ($div.find("a.btn-more").length) {
                    ids[$div.attr("data-id")] = true;
                }
            });
            return Object.keys(ids);
        });

        for (let replyId of replyIds) {
            // 抓取所有楼中楼回复
            const btnMoreSelector = `#comment .comment-list .list-item.reply-wrap[data-id='${replyId}'] a.btn-more`;
            let subReplyPageIndex = 1;
            while (true) {
                let tapSelector;
                if (subReplyPageIndex == 1) {
                    // 楼中楼第一页，点击 “点击查看”按钮记载更多
                    tapSelector = btnMoreSelector;
                }
                else {
                    // 楼中楼第 n 页(n > 1)，点击“下一页”按钮换页
                    const nextASelector = `#comment .comment-list .list-item.reply-wrap[data-id='${replyId}'] .paging-box a.next`;
                    const nextACount = await PuppeteerUtil.count(page, nextASelector);
                    if (nextACount > 0) tapSelector = nextASelector;
                }

                // 如果没有找到对应的按钮，跳出循环
                if (!tapSelector) break;
                else {
                    // 点击按钮，等待请求返回数据
                    const subReplyResWait = this.createWaitReplyOnce(page);
                    await page.evaluate(selector => $(selector)[0].scrollIntoView(), tapSelector);
                    await page.tap(tapSelector);
                    await subReplyResWait;
                    subReplyPageIndex++;
                }
            }
        }
    }

}

@Launcher({
    workplace: __dirname + "/workplace",
    dbUrl: "mongodb://192.168.1.150:27017/bilibili",
    tasks: [
        BilibiliTask
    ],
    workerFactorys: [
        new PuppeteerWorkerFactory({
            headless: false,
            devtools: true
        })
    ]
})
class App {}

const config = {
    maxReplyPageIndex: 3, // 最多只抓取前两页的评论
};
