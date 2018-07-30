export const config = {
    dev: {
        puppeteer: {
            headless: false,
            devtools: true
        },
        logger: {
            level: "debug"
        },
        // 每首歌曲抓取前 commentPages 页评论
        commentPages: 3
    },
    prod: {
        puppeteer: {
            args: [
                "--no-sandbox"
            ]
        },
        logger: {
            level: "info"
        },
        commentPages: 10
    }
}.dev;