import {
    AddToQueue, FromQueue,
    Job,
    logger,
    NoneWorkerFactory,
    OnStart,
    PromiseUtil,
    PuppeteerUtil,
    PuppeteerWorkerFactory
} from "ppspider";
import {config} from "../config";
import {Page} from "puppeteer";
import {githubUserDao} from "../dao/GithubUserDao";
import {githubRepositoryDao} from "../dao/GithubRepositoryDao";

export class TestTask {

    // @OnStart({
    //     urls: "https://github.com/search?q=spider",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    // async index(page: Page, job: Job) {
    //     logger.debugValid && logger.debug("task url: " + job.url());
    //     await PuppeteerUtil.defaultViewPort(page);
    //     await PuppeteerUtil.setImgLoad(page, false);
    //     await page.setCookie(...config.github.cookies);
    //     await page.goto(job.url());
    //     await PromiseUtil.sleep(100000);
    // }

    // @OnStart({
    //     urls: "https://github.com/NHibiki?tab=repositories",
    //     workerFactory: PuppeteerWorkerFactory
    // })
    // async userRepositories(page: Page, job: Job) {
    //     logger.debugValid && logger.debug("task url: " + job.url());
    //     await PuppeteerUtil.defaultViewPort(page);
    //     await PuppeteerUtil.setImgLoad(page, false);
    //     await page.setCookie(...config.github.cookies);
    //     await page.goto(job.url());
    //     await PuppeteerUtil.addJquery(page);
    //
    //     const allRepositories = {};
    //     const maxPage = config.github.user.repositories.maxPage;
    //     for (let i = 0; i < maxPage; i++) {
    //         const repositories = await page.evaluate(() => new Promise(resolve => {
    //             const repositories = [];
    //             $("#user-repositories-list").find("a[itemprop='name codeRepository']").each((index, element) => {
    //                 const repoM = new RegExp("^https://github.com/([^/]+/[^/]+)$").exec(element["href"]);
    //                 if (repoM) {
    //                     repositories.push(repoM[1]);
    //                 }
    //             });
    //             resolve(repositories);
    //         }));
    //         (repositories as string[]).forEach(repo => allRepositories[repo] = true);
    //
    //         const ids = await PuppeteerUtil.specifyIdByJquery(page, ".paginate-container a:contains('Next')");
    //         if (ids) {
    //             await page.tap("#" + ids[0]);
    //             await page.waitForNavigation();
    //         }
    //         else break;
    //     }
    //
    //     const allRepositorieArr = Object.keys(allRepositories);
    //     if (allRepositorieArr.length) {
    //         logger.debugValid && logger.debug("allRepositorieArr", allRepositorieArr);
    //         let userId = new RegExp("https://github.com/([^/]+)\\?tab=repositories").exec(job.url())[1];
    //         await githubUserDao.update({ _id: userId }, { $set: { repositories: allRepositorieArr } });
    //     }
    // }

    @OnStart({
        urls: "https://github.com/fanpei91?tab=stars",
        workerFactory: PuppeteerWorkerFactory
    })
    async userStars(page: Page, job: Job) {
        logger.debugValid && logger.debug("task url: " + job.url());
        await PuppeteerUtil.defaultViewPort(page);
        await PuppeteerUtil.setImgLoad(page, false);
        await page.setCookie(...config.github.cookies);
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
            logger.info(stars);
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
    }

}
