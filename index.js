const puppeteer = require('puppeteer');
const fs = require('fs');

// Function to scroll to the bottom of the page
async function goDown(page) {
    const { scrollPageToBottom } = await import('puppeteer-autoscroll-down');
    await scrollPageToBottom(page, {
        size: 110,
        delay: 10,
    });
}

// Function to get links from a page
async function getLinksFromPage(page, selector) {
    return await page.evaluate(selector => {
        const elements = document.querySelectorAll(selector);
        let linkList = [];
        elements.forEach(element => {
            linkList.push(element.href);
        });
        return linkList;
    }, selector);
}

// Function to handle each link
async function processLink(page, link, selector) {
    let newLinks = [];
    try {
        await page.goto(link);
        await goDown(page);
        await page.waitForSelector(selector, { timeout: 30000 });
        newLinks = await getLinksFromPage(page, selector);
    } catch (error) {
        if (error.name === 'TimeoutError') {
            console.log(`Selector not found on ${link}, moving to next link.`);
        } else {
            throw error;  // Re-throw unexpected errors
        }
    }
    return newLinks;
}

async function getStockData(page, link, selector){
    return 'test'
}

// Main function to run the script
async function run() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.set.or.th/th/market/index/set/overview');

    // Get initial links
    const initialLinks = await getLinksFromPage(page, '.table.b-table.table-hover-underline.b-table-selectable.b-table-no-border-collapse .accordion-collapse a');

    let allLinks = [];
    const newSelector = '.table.b-table.table-custom-field.table-custom-field--cnc.table-hover-underline.b-table-no-border-collapse.b-table-selectable.b-table-select-multi a';

    for (const link of initialLinks) {
        const linksFromPage = await processLink(page, link, newSelector);
        allLinks = allLinks.concat(linksFromPage);
    }

    allLinks = [...new Set(allLinks)];
    allLinks = allLinks.map(url => url.replace(/\/price(?=\/|$)/, '/factsheet'));

    fs.writeFileSync('allLinks.json', JSON.stringify(allLinks, null, 2), 'utf8');

    await browser.close();
}



run();
