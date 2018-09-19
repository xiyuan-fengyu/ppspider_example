import {
    AddToQueue,
    FromQueue,
    Job,
    logger,
    mainMessager, MainMessagerEvent,
    OnStart,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {Page} from "puppeteer";
import {GithubUser} from "../model/GithubUser";
import {githubUserDao} from "../dao/GithubUserDao";
import {config} from "../config";
import {GithubRepository} from "../model/GithubRepository";
import {githubRepositoryDao} from "../dao/GithubRepositoryDao";

const q_user = {
    name: "user"
};
const q_user_repositories = {
    name: "user_repositories"
};
const q_user_stars = {
    name: "user_stars"
};
const q_repositories = {
    name: "repositories"
};
const q_roam = {
    name: "roam"
};

export class GithubSpreadTask {

    @OnStart({
        urls: "https://github.com/",
        workerFactory: PuppeteerWorkerFactory
    })
    private async setCookie(page: Page, job: Job) {
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.setCookie(...config.github.cookies);
        await page.goto(job.url());
        mainMessager.emit(MainMessagerEvent.QueueManager_QueueToggle_queueNameRegex_running, ".*", true);
    }

    /**
     * 从 https://github.com/search?o=desc&q=spider&s=stars&type=Repositories 这个地址更容易找到对spider感兴趣的用户
     * @param {Page} page
     * @param {Job} job
     * @returns {Promise<void>}
     */
    @OnStart({
        urls: "https://github.com/search?q=spider",
        workerFactory: PuppeteerWorkerFactory,
        running: false
    })
    @FromQueue({
        name: "roam",
        workerFactory: PuppeteerWorkerFactory,
        running: false,
        parallel: 1,
        exeInterval: 30000
    })
    @AddToQueue([q_user, q_repositories, q_roam])
    async roam(page: Page, job: Job) {
        logger.debugValid && logger.debug("task url: " + job.url());
        await PuppeteerUtil.defaultViewPort(page);
        await page.goto(job.url());
        return await this.allUrls(page);
    }

    /**
     * 尝试抓取用户信息，主要是用户的id，昵称，区域，邮箱，个人主页
     * @param {Page} page
     * @param {Job} job
     * @returns {Promise<any>}
     */
    @FromQueue({
        name: "user",
        workerFactory: PuppeteerWorkerFactory,
        running: false,
        parallel: 1,
        exeInterval: 30000
    })
    @AddToQueue([q_user, q_user_repositories, q_user_stars, q_repositories, q_roam])
    async user(page: Page, job: Job) {
        logger.debugValid && logger.debug("task url: " + job.url());
        await PuppeteerUtil.defaultViewPort(page);
        await page.setCookie(...config.github.cookies);
        await page.goto(job.url());
        await PuppeteerUtil.addJquery(page);

        // 如果是用户主页，则抓取相关信息
        const userInfo = await page.evaluate(() => new Promise(resolve => {
            const $userDiv = $("div[itemtype='http://schema.org/Person']");
            if ($userDiv.length) {
                // 存在用户的信息框
                const url = window.location.href;
                resolve({
                    _id: url.substring(url.lastIndexOf("/") + 1),
                    name: $userDiv.find("span[itemprop='name']").text().trim(),
                    area: $userDiv.find("li[itemprop='homeLocation'] span").text().trim(),
                    email: $userDiv.find("li[itemprop='email'] a").text().trim(),
                    url: $userDiv.find("li[itemprop='url'] a").text().trim(),
                });
            }
            else resolve();
        }));

        const urls = await this.allUrls(page);
        if (userInfo) {
            logger.debugValid && logger.debug("userInfo", userInfo);
            const githubUser = new GithubUser(userInfo);
            githubUserDao.save(githubUser);

            urls.user_repositories = `https://github.com/${githubUser._id}?tab=repositories`;
            urls.user_stars = `https://github.com/${githubUser._id}?tab=stars`;
        }
        return urls;
    }

    /**
     * 抓取用户的 repositories 列表，只抓取前几页
     * @param {Page} page
     * @param {Job} job
     * @returns {Promise<any>}
     */
    @FromQueue({
        name: "user_repositories",
        workerFactory: PuppeteerWorkerFactory,
        running: false,
        parallel: 1,
        exeInterval: 30000
    })
    @AddToQueue([q_user, q_repositories, q_roam])
    async userRepositories(page: Page, job: Job) {
        logger.debugValid && logger.debug("task url: " + job.url());
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());

        const allRepositories = {};
        const maxPage = config.github.user.repositories.maxPage;
        for (let i = 0; i < maxPage; i++) {
            await PuppeteerUtil.addJquery(page);
            const repositories = await page.evaluate(() => new Promise(resolve => {
                const repositories = [];
                $("#user-repositories-list").find("a[itemprop='name codeRepository']").each((index, element) => {
                    const repoM = new RegExp("^https://github.com/([^/]+/[^/]+)$").exec(element["href"]);
                    if (repoM) {
                        repositories.push(repoM[1]);
                    }
                });
                resolve(repositories);
            }));
            (repositories as string[]).forEach(repo => allRepositories[repo] = true);

            const ids = await PuppeteerUtil.specifyIdByJquery(page, ".paginate-container a:contains('Next')");
            if (ids) {
                const nextHref = await page.evaluate(id => $("#" + id)[0]["href"], ids[0]);
                await page.goto(nextHref);
            }
            else break;
        }

        const allRepositorieArr = Object.keys(allRepositories);
        if (allRepositorieArr.length) {
            logger.debugValid && logger.debug("allRepositorieArr", allRepositorieArr);
            let userId = new RegExp("https://github.com/([^/]+)\\?tab=repositories").exec(job.url())[1];
            await githubUserDao.update({ _id: userId }, { $set: { repositories: allRepositorieArr } });
        }
        return await this.allUrls(page);
    }

    /**
     * 抓取用户的 stars 列表，只抓取前几页
     * @param {Page} page
     * @param {Job} job
     * @returns {Promise<any>}
     */
    @FromQueue({
        name: "user_stars",
        workerFactory: PuppeteerWorkerFactory,
        running: false,
        parallel: 1,
        exeInterval: 30000
    })
    @AddToQueue([q_user, q_repositories, q_roam])
    async userStars(page: Page, job: Job) {
        logger.debugValid && logger.debug("task url: " + job.url());
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());

        const allStars = {};
        const maxPage = config.github.user.stars.maxPage;
        for (let i = 0; i < maxPage; i++) {
            await PuppeteerUtil.addJquery(page);
            const stars = await page.evaluate(() => new Promise(resolve => {
                const stars = [];
                $("div.position-relative > div").not(".TableObject").find("h3 > a").each((index, element) => {
                    const repoM = new RegExp("^https://github.com/([^/]+/[^/]+)$").exec(element["href"]);
                    if (repoM) {
                        stars.push(repoM[1]);
                    }
                });
                resolve(stars);
            }));
            (stars as string[]).forEach(repo => allStars[repo] = true);

            const ids = await PuppeteerUtil.specifyIdByJquery(page, ".paginate-container a:contains('Next')");
            if (ids) {
                const nextHref = await page.evaluate(id => $("#" + id)[0]["href"], ids[0]);
                await page.goto(nextHref);
            }
            else break;
        }

        const allStarsArr = Object.keys(allStars);
        if (allStarsArr.length) {
            logger.debugValid && logger.debug("allStarsArr", allStarsArr);
            let userId = new RegExp("https://github.com/([^/]+)\\?tab=stars").exec(job.url())[1];
            await githubUserDao.update({ _id: userId }, { $set: { stars: allStarsArr } });
        }
        return await this.allUrls(page);
    }

    /**
     * 抓取一个 repositorie 的信息，包括 id，简述，标签列表，相关计数，是否包含中文
     * 标签列表用于判断是否为 spider 相关
     * 是否包含中文 用于判断后续给用户发送邮件该发送中文还是英文
     * @param {Page} page
     * @param {Job} job
     * @returns {Promise<any>}
     */
    @FromQueue({
        name: "repositories",
        workerFactory: PuppeteerWorkerFactory,
        running: false,
        parallel: 1,
        exeInterval: 30000
    })
    @AddToQueue([q_user, q_repositories, q_roam])
    async repositorie(page: Page, job: Job) {
        logger.debugValid && logger.debug("task url: " + job.url());
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.goto(job.url());
        await PuppeteerUtil.addJquery(page);


        if (await PuppeteerUtil.count(page, "div[itemtype='http://schema.org/SoftwareSourceCode']") > 0) {
            const repoId = new RegExp("^https://github.com/([^/]+/[^/]+)$").exec(job.url())[1];
            const repoInfo = await page.evaluate(() => new Promise(resolve => {
                const repoInfo: any = {};
                $("ul.pagehead-actions li a.social-count").each((index, element) => {
                    const ariaLabel = $(element).attr("aria-label");
                    const count = parseInt(ariaLabel.split(" ")[0].replace(/,/g, ''));
                    if (ariaLabel.indexOf("watching") > -1) {
                        repoInfo.watching = count;
                    }
                    else if (ariaLabel.indexOf("starred") > -1) {
                        repoInfo.starred = count;
                    }
                    else if (ariaLabel.indexOf("forked") > -1) {
                        repoInfo.forked = count;
                    }
                });

                repoInfo.issues = parseInt($("nav.reponav a[data-selected-links^='repo_issues'] > span.Counter").text().trim().replace(/,/g, ''));
                repoInfo.pullRequests = parseInt($("nav.reponav a[data-selected-links^='repo_pulls'] > span.Counter").text().trim().replace(/,/g, ''));

                const $repositoryContent = $("div.repository-content");
                repoInfo.about = $repositoryContent.find("span[itemprop='about']:eq(0)").text().trim();
                repoInfo.url = $repositoryContent.find("span[itemprop='url']:eq(0)").text().trim();
                repoInfo.tags = [];
                const spiderKeywords = {
                    spider: true,
                    crawler: true,
                    puppeteer: true,
                    headless: true,
                    selenium: true
                };
                $repositoryContent.find(".repository-topics-container a.topic-tag").each((index, element) => {
                    const tag = $(element).text().trim();
                    repoInfo.tags.push(tag);
                    if (spiderKeywords[tag]) {
                        repoInfo.isSpider = true;
                    }
                });
                if (!repoInfo.isSpider) {
                    const str = (repoInfo.id + " " + repoInfo.about).toLowerCase();
                    repoInfo.isSpider = str.indexOf("spider") > -1 || str.indexOf("crawler") > -1;
                }

                const $numbersSummary = $repositoryContent.find("ul.numbers-summary");
                repoInfo.commits = parseInt($numbersSummary.find("li svg.octicon-history").next("span.num").text().trim().replace(/,/g, ''));
                repoInfo.branches = parseInt($numbersSummary.find("li svg.octicon-git-branch").next("span.num").text().trim().replace(/,/g, ''));
                repoInfo.releases = parseInt($numbersSummary.find("li svg.octicon-tag").next("span.num").text().trim().replace(/,/g, ''));
                repoInfo.contributors = parseInt($numbersSummary.find("li svg.octicon-organization").next("span.num").text().trim().replace(/,/g, ''));
                repoInfo.license = $numbersSummary.find("li svg.octicon-law").parent().text().trim();

                // 从readme中检测是否有中文
                const readme = $("#readme").text();
                let chineseCharNum = 0;
                for (let i = 0, len = readme.length; i < len; i++) {
                    const charCode = readme.charCodeAt(i);
                    if (charCode >= 0x4e00 || charCode <= 0x9fa5) {
                        if (++chineseCharNum == 5) {
                            break;
                        }
                    }
                }
                repoInfo.isChinese = chineseCharNum == 5;
                resolve(repoInfo);
            }));
            repoInfo._id = repoId;

            logger.debugValid && logger.debug("repoInfo", repoInfo);

            const githubRepository = new GithubRepository(repoInfo);
            await githubRepositoryDao.save(githubRepository);
        }
        return await this.allUrls(page);
    }

    private async allUrls(page: Page) {
        const urls = await PuppeteerUtil.links(page, {
            "special": `^https://github.com/(${githubSpecialKeywords})([?/].+)?$`,
            "drop": "^https://github.com/[^/#?]+/[^/#?]+/.+$",
            "user": "^https://github.com/[^/#?]+$",
            "repositories": "^https://github.com/[^/#?]+/[^/#?]+$",
            "roam": "https://github.com/.*"
        });
        delete urls.special;
        delete urls.drop;
        logger.debugValid && logger.debug("urls", urls);
        return urls;
    }

}

const githubSpecialKeywords = `
topics
trending
notifications
pulls
login
search
join
new
issues
features
business
explore
marketplace
pricing
contact
about
site
articles
settings
account
organizations
`.split("\n")
    .map(item => item.trim())
    .filter(item => item)
    .join("|");
