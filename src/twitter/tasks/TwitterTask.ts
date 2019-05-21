import {
    AddToQueue,
    AddToQueueData,
    appInfo,
    FileUtil,
    FromQueue,
    Job,
    logger, NoneWorkerFactory,
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
        urls: "",
        workerFactory: NoneWorkerFactory,
        parallel: 1
    })
    @AddToQueue({
        name: "topics"
    })
    async index(worker: any, job: Job): AddToQueueData {
        // return "http://www.baidu.com";
        return topics.map(item => {
            const url = `https://mobile.twitter.com/search?q=${encodeURI(item)}&src=typed_query`;
            const tempJob = new Job(url);
            tempJob.datas = {
               name: item
            };
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
    async topic(page: Page, job: Job): AddToQueueData {
        await Promise.all([
            PuppeteerUtil.defaultViewPort(page),
            PuppeteerUtil.setImgLoad(page, false)
        ]);

        await page.goto(job.url);
        await PuppeteerUtil.addJquery(page);

        const comments = await page.evaluate(config => new Promise(resolve => {
            const $ = jQuery;
            const comments = [];

            // 超时直接返回结果
            setTimeout(() => resolve(comments), config.movieTaskTimeout);

            // 从一个div中解析出一个评论
            const parseComment = $comment => {
                try {
                    const comment: any = {
                        count: {}
                    };
                    const $infoDivs = $comment.find("> div:eq(1) > div:eq(0) > div");

                    // 用户信息
                    const $userA = $($infoDivs[0]).find("a:eq(0)");
                    comment.user = $userA.attr("href").substring(1).split("/")[0];

                    // comment.user.name = $userA.find("span[dir='auto']:eq(0)").text().trim();

                    // 发表时间
                    comment.time = $($infoDivs[0]).find("time:eq(0)").attr("datetime");

                    let isReplyToOthers = false;
                    if ($infoDivs.length >= 2) {
                        // 回复他人
                        const replyTos = $($infoDivs[1]).find("a span[dir='auto']").text().trim().split("@").filter(item => item);
                        if (replyTos.length > 0) {
                            if (!comment.replyTos) comment.replyTos = [];
                            for (let replyTo of replyTos) {
                                comment.replyTos.push(replyTo);
                            }
                            isReplyToOthers = true;
                        }
                    }

                    // 内容
                    comment.content = $($infoDivs[isReplyToOthers ? 2 : 1]).text();

                    // 推文相关数字统计
                    const $countDivs = $comment.find("> div:eq(1) > div:eq(1) > div");
                    const countKey = ["reply", "forward", "like"];
                    for (let i = 0, len = $countDivs.length; i < 3 && i < len; i++) {
                        const $countDiv = $($countDivs[i]).find("svg:eq(0)").parent().next();
                        if ($countDiv.length) {
                            comment.count[countKey[i]] = parseInt($countDiv.text());
                        }
                        else comment.count[countKey[i]] = 0;
                    }

                    return comment;
                }
                catch (e) {
                    console.log(e);
                }
            };

            const commentMaxNum = config.commentMaxNum;
            const scrollAndCheckMaxNum = config.scrollAndCheckMaxNum;
            const scrollAndCheckInterval = config.scrollAndCheckInterval;

            let curComment = null;
            let curCommentNum = 0;
            let scrollAndCheckNum = 0;

            // 抓取一个评论并向下滚动一个评论的高度，如果下面没有更多评论，则尝试向下滚动加载更多，然后检测时候有新评论
            const scrollAndCheck = () => {
                let waitMore = false;
                const $comments = $("article > div[data-testid='tweet']");
                if ($comments.length) {
                    if (curComment == null) {
                        curComment = $comments[0];
                    }
                    else {
                        for (let j = 0, len = $comments.length; j < len; j++) {
                            if ($comments[j] === curComment) {
                                if (j + 1 < len) {
                                    curComment = $comments[j + 1];
                                    break;
                                }
                                else {
                                    waitMore = true;
                                }
                            }
                        }
                    }
                }
                else {
                    waitMore = true;
                }

                if (waitMore) {
                    scrollAndCheckNum++;
                    if (scrollAndCheckNum < scrollAndCheckMaxNum) {
                        window.scrollBy(0, 1000);
                        setTimeout(scrollAndCheck, scrollAndCheckInterval);
                    }
                    else {
                        resolve(comments);
                    }
                }
                else {
                    curCommentNum++;
                    scrollAndCheckNum = 0;

                    const comment = parseComment($(curComment));
                    if (comment) {
                        comments.push(comment);
                    }

                    if (curCommentNum < commentMaxNum) {
                        window.scrollBy(0, $(curComment).height());
                        setTimeout(scrollAndCheck, 50);
                    }
                    else {
                        resolve(comments);
                    }
                }
            };
            scrollAndCheck();
        }), config.twitter);

        logger.debugValid && logger.debug(JSON.stringify(comments, null, 4));

        // 保存评论信息
        const name = job.datas.name;
        const prettyName = name.replace(new RegExp("[\/. ]", "g"), "_");
        FileUtil.write(appInfo.workplace + "/data/topics/" + prettyName + ".json", JSON.stringify({
            url: job.url,
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
            const tempJob = new Job(`https://mobile.twitter.com/${userId}`);
            tempJob.datas = {
                id: userId
            };
            tempJob.key = userId;
            return tempJob;
        });
    }

    // @OnStart({
    //     description: "测试",
    //     urls: "https://mobile.twitter.com/someUserId",
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
                else if (json.errors) {
                    // 已知错误：用户已被冻结
                    userInfoResolve({
                        errors: json.errors
                    });
                }
            }
            catch (e) {
            }
        });
        await page.goto(job.url);

        let userInfo: any = await waitUserInfo;
        const userId = job.datas.id;
        if (userInfo == null) {
            // 监听用户信息的相应超时，抛出异常，任务失败，任务将会重试两次
            throw new Error(`fail to get userInfo, id: ${userId}`);
        }

        logger.debugValid && logger.debug(JSON.stringify(userInfo, null, 4));
        if (!userInfo.errors) {
            FileUtil.write(appInfo.workplace + "/data/users/" + userId + ".json", JSON.stringify(userInfo));
        }
        else {
            logger.warnValid && logger.warn(`fail to get userInfo, id: ${userId}\n${JSON.stringify(userInfo, null, 4)}`);
        }
    }

}