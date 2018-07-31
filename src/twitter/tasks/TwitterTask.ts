import {
    AddToQueue,
    AddToQueueData,
    appInfo,
    DefaultJob,
    FileUtil,
    FromQueue,
    Job,
    logger,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";
import {topics} from "../topics";
import {config} from "../config";

export class TwitterTask {

    @OnStart({
        description: "从 topics 把所有任务加载到 topics 队列中",
        urls: "useless url, but cannot be empty",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1
    })
    @AddToQueue({
        name: "topics"
    })
    async index(page: Page, job: Job): AddToQueueData {
        // return "http://www.baidu.com";
        return topics.map(item => {
            const url = `https://mobile.twitter.com/search?q=${encodeURI(item)}&src=typed_query`;
            const tempJob = new DefaultJob(url);
            tempJob.datas({
               name: item
            });
            return tempJob;
        });
    }

    @FromQueue({
        description: "抓取一个 topic 的评论列表信息",
        name: "topics",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1,
        exeInterval: 10000
    })
    @AddToQueue({
        name: "users"
    })
    async movie(page: Page, job: Job): AddToQueueData {
        await Promise.all([
            PuppeteerUtil.defaultViewPort(page),
            PuppeteerUtil.setImgLoad(page, false)
        ]);

        await page.goto(job.url());
        await PuppeteerUtil.addJquery(page);

        const comments = await page.evaluate(config => new Promise(resolve => {
            // debugger;
            const $ = jQuery;
            const comments = [];

            // 超时直接返回结果
            setTimeout(() => resolve(comments), config.movieTaskTimeout);

            const commentMaxNum = config.commentMaxNum;
            const scrollAndCheckMaxNum = config.scrollAndCheckMaxNum;
            const scrollAndCheckInterval = config.scrollAndCheckInterval;

            let scrollAndCheckNum = 0;
            const parseComment = $comment => {
                try {
                    const comment: any = {
                        count: {}
                    };

                    const $mainDivs = $comment.find("> div:eq(1) > div:eq(0) > div");

                    // 用户信息
                    const $userA = $($mainDivs[0]).find("> div:eq(0) > a:eq(0)");
                    comment.user = $userA.attr("href").substring(1).split("/")[0];

                    // comment.user.name = $userA.find("span[dir='auto']:eq(0)").text().trim();

                    // 发表时间
                    comment.time = $($mainDivs[0]).find("> div:eq(0) > a:eq(1) time").attr("datetime");

                    if ($mainDivs.length == 3) {
                        // 回复他人
                        const replyTos = $($mainDivs[1]).find("a:eq(0) span[dir='auto']").text().trim().split(" ");
                        replyTos.forEach(replyTo => {
                            if (replyTo.startsWith("@")) {
                                if (!comment.replyTos) comment.replyTos = [];
                                comment.replyTos.push(replyTo.substring(1));
                            }
                        });
                    }

                    // 内容
                    comment.content = $($mainDivs[$mainDivs.length - 1]).text();

                    // 推文相关数字统计
                    const $countDivs = $comment.find("> div:eq(1) > div:eq(1) > div");
                    const countKey = ["reply", "forward", "like"];
                    for (let i = 0, len = $countDivs.length; i < 3 && i < len; i++) {
                        const $svgCountDivs = $($countDivs[i]).find("> div:eq(0) > div:eq(0) > div");
                        if ($svgCountDivs.length == 2) {
                            comment.count[countKey[i]] = parseInt($($svgCountDivs[1]).text());
                        }
                        else comment.count[countKey[i]] = 0;
                    }

                    return comment;
                }
                catch (e) {
                    console.log(e);
                }
            };


            let $curCommentBox = null;
            const scrollAndCheck = () => {
                let tempScrollAndCheckInterval = 50;
                if ($curCommentBox === null) {
                    const $comments = $("article > div[data-testid='tweet']");
                    if ($comments.length) {
                        $curCommentBox = $($comments[0]).parent().parent().parent();
                        scrollAndCheckNum = 0;
                    }
                }
                else {
                    let $next = $curCommentBox.next();
                    if ($next.length) {
                        $curCommentBox = $next;
                        scrollAndCheckNum = 0;
                    }
                    else {
                        $next = $($curCommentBox.prevObject[0]).next();
                        if ($next.length && $next[0] != $curCommentBox[0]) {
                            $curCommentBox = $next;
                            scrollAndCheckNum = 0;
                        }
                        else {
                            scrollAndCheckNum++;
                            tempScrollAndCheckInterval = scrollAndCheckInterval;
                        }
                    }
                }

                if (scrollAndCheckNum == 0 && $curCommentBox && $curCommentBox.length) {
                    const comment = parseComment($curCommentBox.find("article > div[data-testid='tweet']"));
                    if (comment) {
                        comments.push(comment);
                    }
                    window.scrollBy(0, $curCommentBox.height());
                }
                else {
                    window.scrollBy(0, 100);
                }

                if (scrollAndCheckNum >= scrollAndCheckMaxNum || comments.length >= commentMaxNum) {
                    resolve(comments);
                }
                else {
                    setTimeout(scrollAndCheck, tempScrollAndCheckInterval);
                }
            };
            scrollAndCheck();
        }), config.twitter);

        logger.debugValid && logger.debug(JSON.stringify(comments, null, 4));

        // 保存评论信息
        const name = job.datas().name;
        const prettyName = name.replace(new RegExp("[\/. ]", "g"), "_");
        FileUtil.write(appInfo.workplace + "/data/topics/" + prettyName + ".json", JSON.stringify({
            url: job.url(),
            name: name,
            comments: comments
        }));

        // 将用户添加到队列中，抓取用户信息
        const userIds = [];
        (comments as Array<any>).forEach(comment => {
            if (comment.user) userIds.push(comment.user);
            if (comment.replyTos) comment.replyTos.forEach(id => userIds.push(id));
        });
        return userIds.map(userId => {
            const tempJob = new DefaultJob(`https://mobile.twitter.com/${userId}`);
            tempJob.datas({
                id: userId
            });
            tempJob.key(userId);
            return tempJob;
        });
    }

    // @OnStart({
    //     description: "测试",
    //     urls: "https://mobile.twitter.com/LoremasterNojah",
    //     workerFactory: PuppeteerWorkerFactory,
    //     parallel: 1,
    //     exeInterval: 10000000
    // })
    @FromQueue({
        description: "抓取一个user的信息",
        name: "users",
        workerFactory: PuppeteerWorkerFactory,
        parallel: 1,
        exeInterval: 5000
    })
    async user(page: Page, job: Job) {
        await Promise.all([
            PuppeteerUtil.defaultViewPort(page),
            PuppeteerUtil.setImgLoad(page, false)
        ]);

        let userInfoResolve;
        const waitUserInfo = new Promise(resolve => {
            setTimeout(() => resolve(null), 30000);
            userInfoResolve = resolve;
        });
        PuppeteerUtil.onResponse(page, ".*/graphql/.*", async response => {
            try {
                const json = await response.json();
                if (json.data && json.data.user && json.data.user.legacy) {
                    userInfoResolve(json.data.user.legacy);
                }
            }
            catch (e) {
            }
        });
        await page.goto(job.url());

        let userInfo = await waitUserInfo;
        const userId = job.datas().id;
        if (userInfo == null) {
            throw new Error(`fail to get userInfo, id: ${userId}`);
        }

        logger.debugValid && logger.debug(JSON.stringify(userInfo, null, 4));
        FileUtil.write(appInfo.workplace + "/data/users/" + userId + ".json", JSON.stringify(userInfo));
    }

}