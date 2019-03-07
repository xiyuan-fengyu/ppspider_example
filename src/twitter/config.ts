export const config = {
    dev: {
        puppeteer: {
            headless: false,
            devtools: true,
            args: [
                "--proxy-server=127.0.0.1:2007"
            ]
        },
        twitter: {
            // 抓取一个电影的信息的超时时间(单位：毫秒)
            movieTaskTimeout: 1000 * 60 * 20,
            // 一个电影最多抓取多少条评论
            commentMaxNum: 50,
            // 向下滚动加载更多评论的最大尝试次数
            scrollAndCheckMaxNum: 10,
            // 每次滚动检查评论的间隔(单位：毫秒)
            scrollAndCheckInterval: 1000
        },
        logger: {
            level: "info"
        }
    },
    prod: {
        puppeteer: {
            args: [
                "--no-sandbox"
            ]
        },
    }
}[(process.argv.find(item => item.startsWith("-env=")) || "-env=dev").substring(5)];