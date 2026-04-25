import { chromium } from 'playwright';
async function run() {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent('<button>엑셀 다운로드</button>');
    const ready = await page.evaluate(() => {
        const dBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('엑셀 다운로드'));
        return !!dBtn;
    });
    console.log(ready);
    await browser.close();
}
run();
