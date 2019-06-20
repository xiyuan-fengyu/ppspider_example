import {
    AddToQueue,
    AddToQueueData,
    appInfo, DbHelperUi,
    FromQueue,
    Job,
    JobOverride,
    Launcher, NetworkTracing,
    OnStart, Page, PromiseUtil,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";

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
        urls: "https://www.bilibili.com/"
    })
    @AddToQueue({ name: "videos" })
    async roam(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.defaultViewPort(page); // 设置分辨率 1920 * 1080
        await PuppeteerUtil.setImgLoad(page, false); // 禁用图片加载
        await page.goto(job.url); // 跳转网页
        await PuppeteerUtil.scrollToBottom(page); // 滚动到网页底部，以触发所有资源的加载
        return await PuppeteerUtil.links(page, {
            videos: ".*bilibili.*/video/av.*"
        });
    }

    @FromQueue({
        name: "videos",
        exeInterval: 5000,
        parallel: 1
    })
    @AddToQueue({ name: "videos" })
    async video(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);

        const aid = job.datas.id;
        const videoInfo: any = {
            _id: aid
        };

        const tagsResWait = PuppeteerUtil.onceResponse(page, "api.bilibili.com/x/tag/archive/tags", async response => {
            videoInfo.tags = PuppeteerUtil.jsonp(await response.text()).data;
        });
        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);

        // 抓取视频的基本信息 https://api.bilibili.com/x/web-interface/view?aid=avId
        const info = await this.get(page, `https://api.bilibili.com/x/web-interface/view?aid=${aid}`);
        Object.assign(videoInfo, info.data);
        // 抓取相关视频列表
        videoInfo.related = (await this.get(page, `https://api.bilibili.com/x/web-interface/archive/related?aid=${aid}&jsonp=jsonp`)).data;
        await tagsResWait;

        // 保存视频信息
        await appInfo.db.save("video", videoInfo);

        // 第一页的主楼评论
        const mainReplyResWait = this.createWaitReplyOnce(page, "api.bilibili.com/x/v2/reply\\?");
        await PuppeteerUtil.scrollToBottom(page, 5000, 100, 1000);
        await mainReplyResWait;

        // 抓取评论
        for (let i = 1; i <= config.maxReplyPageIndex; i++) {
            await this.getPageReplies(page, i);
        }

        return await PuppeteerUtil.links(page, {
            videos: ".*bilibili.*/video/av.*"
        });
    }

    private createWaitReplyOnce(page: Page, urlReg: string, timeout: number = 10000) {
        return PuppeteerUtil.onceResponse(page, urlReg, async response => {
            const res = PuppeteerUtil.jsonp(await response.text());
            await this.saveReplies(res.data.replies);
        }, timeout);
    }

    /**
     * 主楼切换分页，楼中楼加载更多和切换分页
     * @param page
     * @param pageIndex
     */
    private async getPageReplies(page: Page, pageIndex: number) {
        if (pageIndex == 1) {
            // 第一页的主楼评论已经抓取了
        }
        else {
            // 点击主楼换页，并监听接口返回结果
            const nextPageBtnId = await PuppeteerUtil.specifyIdByJquery(page,
                `#comment .bottom-page.paging-box-big a:contains('${pageIndex}')`);
            if (!nextPageBtnId) return;

            const mainReplyResWait = this.createWaitReplyOnce(page, "api.bilibili.com/x/v2/reply\\?");
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
                    const subReplyResWait = this.createWaitReplyOnce(page, "api.bilibili.com/x/v2/reply(/reply)?\\?", 5000);
                    await page.tap(tapSelector);
                    if ((await subReplyResWait).isTimeout) {
                        // 继续尝试，子楼分页数不增加
                    }
                    else {
                        subReplyPageIndex++;
                    }
                }
            }
        }
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

                // 删除不必要的信息
                delete reply.folder;
                delete reply.replies;

                waitArr.push(appInfo.db.save("reply", reply));
            }
        }
        return Promise.all(waitArr);
    }

    private async get(page: Page, url: string) {
        const res = await page.evaluate(url => new Promise<string>(resolve => {
            $.get(url, res => {
                resolve(res);
            }, "text");
        }), url);
        if (res.startsWith("{")) {
            return JSON.parse(res);
        }
        else {
            return PuppeteerUtil.jsonp(res);
        }
    }

}

@Launcher({
    workplace: "workplace_bilibili",
    // dbUrl: "mongodb://192.168.1.150:27017/bilibili",
    // dbUrl: "nedb://workplace_bilibili/nedb",
    tasks: [
        BilibiliTask
    ],
    dataUis: [
        DbHelperUi
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
