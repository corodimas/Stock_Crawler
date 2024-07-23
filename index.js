const puppeteer = require('puppeteer');
const fs = require('fs');
const Testlinks = JSON.parse(fs.readFileSync('allLinks.json', 'utf8'));

async function goDown(page) {
    const { scrollPageToBottom } = await import('puppeteer-autoscroll-down');
    await scrollPageToBottom(page, {
        size: 110,
        delay: 10,
    });
}

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

async function getStockData(page) {
    await goDown(page)
    const stockName = await page.evaluate(() => {
        const name = document.querySelector('.d-flex.flex-column.ms-3 h1');
        return name ? name.innerText : 'unknown';
    });

    const tableData = await page.evaluate(() => {
        function extractYear(header) {
            const match = header.match(/\b\d{4}\b/);
            return match ? match[0] : null;
        }

        const tables = document.querySelectorAll('table');
        const arrayOfWantedTable = [7, 8, 20, 24];

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

        const filteredTableData = allTableData.map(table => {
            const validColumns = table.columns[0].filter(header => !header.includes('Q1') && !header.includes('YTD') && !header.includes('6M'));
            const validIndexes = table.columns[0].reduce((acc, header, index) => {
                if (validColumns.includes(header) && !['Accounting Type', 'Column0', 'Column1', 'Column2', 'Column3'].includes(header)) {
                    acc.push(index);
                }
                return acc;
            }, []);

            const filteredRows = table.rows.map(row => validIndexes.map(index => row[index]));
            const filteredColumns = validColumns.map((header, index) => header);

            return {
                columns: [filteredColumns],
                rows: filteredRows
            };
        });

        const baseColumns = filteredTableData[2].columns[0];
        const baseYears = baseColumns.map(extractYear);

        const alignedTableData = filteredTableData.map(table => {
            const columnYears = table.columns[0].map(extractYear);

            const alignedRows = table.rows.map(row => {
                const alignedRow = baseYears.map(baseYear => {
                    const columnIndex = columnYears.indexOf(baseYear);
                    return columnIndex > -1 ? row[columnIndex] : '';
                });
                return alignedRow;
            });

            return {
                columns: [baseColumns],
                rows: alignedRows
            };
        });

        const headers = alignedTableData[0].columns[0].slice(1);
        const result = [];
        headers.forEach((header, index) => {
            const financialData = {};
            for (const test of alignedTableData) {
                test.rows.forEach(row => {
                    financialData[row[0]] = row[index + 1];
                });
            }
            result.push({
                date: header,
                financialData
            });
        });

        return result;
    });

    return({name:stockName,data:tableData})
}

async function run() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const links = JSON.parse(fs.readFileSync('allLinks.json', 'utf8'));

    result = []

    for (const link of links) {
        try {
          await page.goto(link);
          const data = await getStockData(page)
          console.log(data)
          result.push(data)
        } catch (error) {
          console.error(`Failed to navigate to ${link}: ${error.message}`);
        }
      }
      fs.writeFileSync('StockData.json', JSON.stringify(result, null, 2), 'utf8');

    await browser.close();
}

run();
