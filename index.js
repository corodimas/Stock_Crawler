const puppeteer = require('puppeteer');
const fs = require('fs');


async function goDown(page) {
    const { scrollPageToBottom } = await import('puppeteer-autoscroll-down');
    await scrollPageToBottom(page, {
    size: 110,
    delay: 10,
})}

async function run() {
    const browser = await puppeteer.launch({headless:false});
    const page = await browser.newPage();
    await page.goto('https://www.set.or.th/th/market/index/set/overview');

    await page.screenshot({ path: 'example.png', fullPage: true });

    

    

    // Get initial links
    const initialLinks = await page.evaluate(() => {
        const elements = document.querySelectorAll('.table.b-table.table-hover-underline.b-table-selectable.b-table-no-border-collapse .accordion-collapse a');
        let linkList = [];
        elements.forEach(element => {
            linkList.push(element.href);
        });
        return linkList;
    });

    let allLinks = [];

    for (const link of initialLinks) {
        await page.goto(link);
        
        try {
            await goDown(page);
            await page.waitForSelector('.table.b-table.table-custom-field.table-custom-field--cnc.table-hover-underline.b-table-no-border-collapse.b-table-selectable.b-table-select-multi a', { timeout: 30000 });
            
            const newLinks = await page.evaluate(() => {
                const elements = document.querySelectorAll('.table.b-table.table-custom-field.table-custom-field--cnc.table-hover-underline.b-table-no-border-collapse.b-table-selectable.b-table-select-multi a');
                let linkList = [];
                elements.forEach(element => {
                    linkList.push(element.href);
                });
                return linkList;
            });

            allLinks = allLinks.concat(newLinks);
        } catch (error) {
            if (error.name === 'TimeoutError') {
                console.log(`Selector not found on ${link}, moving to next link.`);
            } else {
                throw error;  // Re-throw unexpected errors
            }
        }
    }

    // Remove duplicate links
    allLinks = [...new Set(allLinks)];

    console.log(allLinks);

    fs.writeFileSync('allLinks.txt', allLinks.join('\n'), 'utf8');

    await browser.close();
}

run();
