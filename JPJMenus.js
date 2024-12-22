// surgePricingUpdater.js
const puppeteer = require('puppeteer');
const config = require(`./config`);
const e = require('express');

async function main(setToConcert) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Use basic authentication by setting credentials in the URL
    const username = config.JPJMenus.username;
    const password = config.JPJMenus.password;
    const url = `https://${username}:${password}@jpjmenus.spectrumintegrators.com/admin/#`;

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log("Page loaded with basic authentication");
    } catch (error) {
        console.error("Failed to authenticate:", error.message);
    }

    // Extract URLs from the navbar links on the page directly
    const urls = await getUrls(page);

    // Start the recursive tab swap and update process
    await processTabs(page, urls, setToConcert);

    // Close the browser when done
    await browser.close();
}

async function getUrls(page) {
    try {
        const homepageUrl = 'https://jpjmenus.spectrumintegrators.com/admin/#';

        const allUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#navbar a'))
                .map(link => {
                    const parsedUrl = new URL(link.href);
                    parsedUrl.username = '';
                    parsedUrl.password = '';
                    return parsedUrl.toString();
                });
        });

        // Filter out the exact homepage URL
        return allUrls.filter(url => url !== homepageUrl);

    } catch (error) {
        console.error("Failed to retrieve URLs:", error.message);
        return [];
    }
}

// Recursive function to process each tab and perform updates
async function processTabs(page, urls, setToConcert) {
    if (urls.length === 0) {
        console.log("All tabs processed.");
        return; // End recursion
    }

    // Remove the first URL to process 
    const nextPage = urls.shift();
    
    try {
        // Go to the next page
        await page.goto(nextPage, { waitUntil: 'networkidle2' });
        console.log(`Navigated to ${nextPage}`);

        await delay(1000);
        
        // Extract table data
        const tableData = await extractTableData(page);
        // console.log("Extracted table data:", tableData);

        // Check if the pricing state matches the desired state
        const alreadySet = checkPricingState(tableData, setToConcert);

        if (alreadySet === true) {
            console.log(`Pricing state already matches 'setToConcert' (${setToConcert}). Skipping updates for ${nextPage}.`);
        } else {
            // Determine and toggle surge pricing
            const updatedTableData = toggleSurgePricing(tableData, nextPage);
            // console.log("Updated table data:", updatedTableData);

            // Input updated prices and save
            await inputPricesAndSave(page, updatedTableData);
        }
        
    } catch (error) {
        console.error(`Failed to process ${nextPage}:`, error.message);
        updatedTableData = [];
    }

    // Recursive call to process the next URL
    await delay(500);
    await processTabs(page, urls, setToConcert);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractTableData(page) {
    try {
        // Wait for the table rows to be present on the page
        await page.waitForSelector('#menuitems tr.menuitem', { timeout: 5000 });

        return await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#menuitems tr.menuitem'));
            return rows.map(row => {
                const cells = row.querySelectorAll('td');
                
                return {
                    name: cells[0]?.querySelector('input')?.value.trim() || cells[0]?.innerText.trim(),
                    price: cells[1]?.querySelector('input')?.value.trim() || cells[1]?.innerText.trim(),
                    calories: cells[2]?.querySelector('input')?.value.trim() || cells[2]?.innerText.trim()
                };
            });
        });
    } catch (error) {
        console.error("Failed to extract table data or table not found:", error.message);
        return [];  // Return an empty array in case of failure
    }
}

function checkPricingState(data, setToConcert) {
    // Find the water item to check current pricing state
    const waterItem = data.find(item => item.name === 'Bottled Water');
    const waterPrice = parseFloat(waterItem.price.replace(/[^\d.-]/g, ''));
    const isSurgePricing = waterPrice === 4.99;

    // If `setToConcert` is true, expect 3.99; if false, expect 4.99
    if (setToConcert && !isSurgePricing) {
        return false; // Water is not at surge price, needs update
    }
    if (!setToConcert && isSurgePricing) {
        return false; // Water is at surge price, needs update
    }

    return true; // Pricing state matches the desired state
}

// Helper function to toggle surge pricing
function toggleSurgePricing(data, currentUrl) {
    // Check if we're on a "Ben & Jerry's" tab
    const isBenAndJerrys = currentUrl.includes("Ben"); 

    // Find the water item to check current pricing state
    const waterItem = data.find(item => item.name === 'Bottled Water');
    const isSurgePricing = waterItem && parseFloat(waterItem.price.replace('$', '')) === 4.99;

    return data.map(item => {
        // Skip items without a price
        if (!item.price) return item; 

        const currentPrice = parseFloat(item.price.replace('$', ''));

        // Edge case 1: Hubs Peanuts always remains $0.99
        if (item.name === 'Hubs Peanuts') {
            return { ...item, price: '$.99' };
        }

        // Edge case 2: Wine always remains $12.99
        if (item.name === 'Premium Wine 5oz') {
            return { ...item, price: '$12.99' };
        }

        // Determine the price change amount
        let priceChange;
        if (item.name === 'Premium Can 16oz' || item.name === 'Domestic Can 16oz') {
            // Edge case 3: Premium and Domestic Can 16oz prices fluctuate by $2
            priceChange = isSurgePricing ? -2 : 2;
        } else if (isBenAndJerrys && (item.name.includes('Soda') || item.name.includes('Gatorade') || item.name.includes('Water'))) {
            // Edge case 4: Only change drink prices on Ben & Jerry's tabs based on URL
            priceChange = isSurgePricing ? -1 : 1;
        } else if (!isBenAndJerrys) {
            // Default price change for all other items outside Ben & Jerry's
            priceChange = isSurgePricing ? -1 : 1;
        } else {
            // Skip items on Ben & Jerry's that aren’t drinks
            return item;
        }

        // Calculate the new price with appropriate change
        const newPrice = (currentPrice + priceChange).toFixed(2);

        return {
            ...item,
            price: `$${newPrice}`
        };
    });
}

async function inputPricesAndSave(page, updatedTableData) {
    try {
        // Iterate over each row in the table data
        for (const item of updatedTableData) {
            // Locate the row with the matching item name
            await page.evaluate((item) => {
                const rows = Array.from(document.querySelectorAll('#menuitems tr.menuitem'));
                for (let row of rows) {
                    const nameCell = row.querySelector('td:nth-child(1) input');
                    if (nameCell && nameCell.value.trim() === item.name) {
                        const priceInput = row.querySelector('td:nth-child(2) input');
                        if (priceInput) {
                            priceInput.value = item.price; 
                        }
                        break;
                    }
                }
            }, item);
        }

        // Locate and click the "Save Menu" button
        await page.click('button[title="Save Menu"]');
        console.log("Prices updated and saved successfully.");
        await delay(1000);

    } catch (error) {
        console.error("Failed to update prices and save:", error.message);
    }
}

module.exports = { main }