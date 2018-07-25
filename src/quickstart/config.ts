export const config = {
    dev: {
        puppeteer: {
            headless: false,
            devtools: true
        },
    },
    prod: {
        puppeteer: {
            args: [
                "--no-sandbox"
            ]
        },
    }
}.dev;