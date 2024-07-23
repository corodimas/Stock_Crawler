const puppeteer = require('puppeteer');
const fs = require('fs');
const { header } = require('express/lib/request');
const Testlinks = JSON.parse(fs.readFileSync('allLinks.json', 'utf8'));

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

async function getStockData(page){
    await page.goto('https://www.set.or.th/en/market/product/stock/quote/gfpt/factsheet');
    await goDown(page);
    const tableData = await page.evaluate(() => {
        //const selector = '.table.b-table.table-custom-field.table-custom-field--cnc.table-hover-underline.b-table-no-border-collapse'
        const tables = document.querySelectorAll(`table`);
        const arrayOfWantedTable = [7,8,20,24]

        const extractTableData = (table) => {
            const rows = table.querySelectorAll('tbody tr');
            const columns = table.querySelectorAll('thead tr');
            
            const rowData = Array.from(rows).map(row => {
                const cells = row.querySelectorAll('td');
                return Array.from(cells).map(cell => cell.innerText.trim());
            });
            
            const columnData = Array.from(columns).map(column => {
                const cells = column.querySelectorAll('th');
                return Array.from(cells).map(cell => cell.innerText.trim().replace(/\s+/g, ' '));
            });
            
            return { columns: columnData, rows: rowData };
        };

        const allTableData = arrayOfWantedTable.map(index => {
            const table = tables[index];
            return extractTableData(table);
        });



        const headers = allTableData[0].columns[0].slice(1);
        const result = [];
        headers.forEach((header, index) => {
            const financialData = {};
            allTableData[0].rows.forEach(row => {
              financialData[row[0]] = row[index + 1];
            });
            result.push({
              date: header,
              financialData
            });
          });

        return allTableData

      });
    console.log(tableData)
     fs.writeFileSync('testData.json', JSON.stringify(tableData, null, 2), 'utf8');
}

// Main function to run the script
async function run() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    //await page.goto('https://www.set.or.th/en/market/index/set/overview');

    await getStockData(page)
    // // Get initial links
    // const initialLinks = await getLinksFromPage(page, '.table.b-table.table-hover-underline.b-table-selectable.b-table-no-border-collapse .accordion-collapse a');

    // let allLinks = [];
    // const newSelector = '.table.b-table.table-custom-field.table-custom-field--cnc.table-hover-underline.b-table-no-border-collapse.b-table-selectable.b-table-select-multi a';

    // for (const link of initialLinks) {
    //     const linksFromPage = await processLink(page, link, newSelector);
    //     allLinks = allLinks.concat(linksFromPage);
    // }

    // allLinks = [...new Set(allLinks)];
    // allLinks = allLinks.map(url => url.replace(/\/price(?=\/|$)/, '/factsheet'));

    // fs.writeFileSync('allLinks.json', JSON.stringify(allLinks, null, 2), 'utf8');

    await browser.close();
}



run();
