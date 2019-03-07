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
}[(process.argv.find(item => item.startsWith("-env=")) || "-env=dev").substring(5)];