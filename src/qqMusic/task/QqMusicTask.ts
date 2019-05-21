import {
    AddToQueue,
    AddToQueueData, appInfo, FileUtil,
    FromQueue,
    Job,
    JobOverride, logger,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";
import {config} from "../config";

const queue_qq = {
    name: "qq"
};

const queue_qq_song = {
    name: "qq_song"
};

export class QqMusicTask {

    @JobOverride("qq_song")
    @JobOverride("OnStart_QqMusicTask_index")
    @JobOverride("OnStart_QqMusicTask_song")
    qqSongJobOverride(job: Job) {
        // 重写 job 的key，增强去重的效果
        const match = job.url.match("https://y.qq.com/n/yqq/song/(.*?)\\.html.*");
        if (match) job.key = match[1];
    }

    @OnStart({
        urls: "https://y.qq.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    @FromQueue({
        name: "qq",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1,
        exeInterval: 5000
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async index(page: Page, job: Job): AddToQueueData {
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url);
        return await PuppeteerUtil.links(page, {
            qq_song: "https://y.qq.com/n/yqq/song/.*",
            qq: "https://y.qq.com/.*"
        });
    }

    @FromQueue({
        name: "qq_song",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue([
        queue_qq,
        queue_qq_song
    ])
    async song(page: Page, job: Job): AddToQueueData {
        logger.debugValid && logger.debug(job.key + "    " + job.url);

        const songId = job.key;

        await PuppeteerUtil.setImgLoad(page, false);

        const songRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg\\?.*", async response => {
                const text = await response.text();
                FileUtil.write(appInfo.workplace + "/qq/" + songId + "/song.json", JSON.stringify(PuppeteerUtil.jsonp(text)));
            });

        const albumRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg\\?.*", async response => {
                const text = await response.text();
                FileUtil.write(appInfo.workplace + "/qq/" + songId + "/album.json", JSON.stringify(PuppeteerUtil.jsonp(text)));
            });

        const lyricRes = PuppeteerUtil.onceResponse(page,
            "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric.fcg\\?.*", async response => {
                const text = await response.text();
                FileUtil.write(appInfo.workplace + "/qq/" + songId + "/lyric.json", JSON.stringify(PuppeteerUtil.jsonp(text)));
            });

        const commentRes = PuppeteerUtil.onResponse(page,
            "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg\\?.*", async response => {
                const text = await response.text();
                const json = PuppeteerUtil.jsonp(text);
                if (json.hasOwnProperty("commenttotal")) {
                    FileUtil.write(appInfo.workplace + "/qq/" + songId + "/comment_total.json", JSON.stringify(json));
                }
                else {
                    FileUtil.write(appInfo.workplace + "/qq/" + songId + "/comment_0.json", JSON.stringify(json));
                }
            }, 2);

        await page.goto(job.url);
        // 等待基本信息和第一页的评论抓取完成
        await Promise.all([songRes, albumRes, lyricRes, commentRes]);

        // 如果有多页评论，可以找到 $(".mod_page_nav.js_pager_comment .current") 这种节点
        // 如果只有一页评论，可以找到 $(".comment__show_all_link") 这种节点
        await new Promise(resolve => {
            page.waitForSelector(".mod_page_nav.js_pager_comment .current", {
                timeout: 10000
            }).then(() => resolve());
            page.waitForSelector(".comment__show_all_link", {
                timeout: 10000
            }).then(() => resolve());
        });

        // 抓取前 config.commentPages 页的评论
        let nextCommentPageNum = 2;
        while (nextCommentPageNum <= config.commentPages) {
            const selector = `a.js_pageindex[data-index='${nextCommentPageNum}']`;
            const nexPageBtnCount = await PuppeteerUtil.count(page, selector);
            if (nexPageBtnCount) {
                const nextCommentPageRes = PuppeteerUtil.onceResponse(page,
                    "https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg\\?.*", async response => {
                        const text = await response.text();
                        const pageNum = response.url().match(".*&pagenum=(\\d+).*")[1];
                        FileUtil.write(appInfo.workplace + "/qq/" + songId + "/comment_" + pageNum + ".json", JSON.stringify(PuppeteerUtil.jsonp(text)));
                    });
                page.tap(selector);
                await nextCommentPageRes;
            }
            else break;
            nextCommentPageNum++;
        }

        return await PuppeteerUtil.links(page, {
            qq_song: "https://y.qq.com/n/yqq/song/.*",
            qq: "https://y.qq.com/.*"
        });
    }

}