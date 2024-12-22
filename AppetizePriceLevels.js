const puppeteer = require('puppeteer');
const config = require(`./config`);

async function main(setToConcert){
  const browser = await puppeteer.launch({ headless: false }); // Set to true for headless mode
  const page = await browser.newPage();
  
  await loginToAppetize(page);

  await navigateToVendorsPage(page);

  await searchVendors(page);

  const vendorIds = await extractVendorIDs(page);

  await updateVendorPriceLevel(page, vendorIds, setToConcert);

  // Close the browser
  await browser.close();
}

async function loginToAppetize(page) {
  // Navigate to the login page
  await page.goto('https://connect.appetizeapp.com/login');

  // Fill in the username
  await page.type('#login', config.Appetize.username);

  // Fill in the password
  await page.type('#password', config.Appetize.password);

  // Wait for the reCAPTCHA to be solved. Adjust timeout as needed
  await page.waitForSelector('.g-recaptcha-response:not([value=""])', { timeout: 60000 });

  // Click the login button
  await page.click('button.login-form-submit');

  // Wait for navigation to confirm login success
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
}

async function navigateToVendorsPage(page) {
  try {
    // Navigate directly to the vendors page
    await page.goto('https://connect.appetizeapp.com/vendors', { waitUntil: 'networkidle0' });

  } catch (error) {
    console.error('Error navigating to the vendors page:', error);
  }
}

async function searchVendors(page) {
  try {
    // Wait for the input field to appear
    await page.waitForSelector('input[name="search_text"]');

    // Focus on the search field and type "JPJ"
    await page.type('input[name="search_text"]', 'JPJ');

    // Simulate pressing Enter
    await page.keyboard.press('Enter');

    // Capture the initial table content
    const initialContent = await page.evaluate(() => {
      return document.querySelector('table').innerText;
    });

    // Wait for the table content to change
    await page.waitForFunction(
      previousContent => {
        const table = document.querySelector('table');
        return table && table.innerText !== previousContent;
      },
      { timeout: 5000 },
      initialContent
    );

  } catch (error) {
    console.error('Error performing search:', error);
  }
}

async function extractVendorIDs(page) {
  try {
    // Wait for the table rows to appear
    await page.waitForSelector('tr[data-vendor-id]');

    // Extract all rows with titles and get the numbers
    const vendorIDs = await page.evaluate(() => {
      // Select all rows with a `title` attribute
      const rows = Array.from(document.querySelectorAll('tr[data-vendor-id]'));

      // Map through the rows to extract and clean the IDs
      return rows.map(row => {
        const title = row.getAttribute('data-vendor-id'); 
        const match = title.match(/\d+/); 
        return match ? parseInt(match[0], 10) : null; 
      }).filter(id => id !== null); 
    });

    console.log('Extracted Vendor IDs:', vendorIDs);

    return vendorIDs;
  } catch (error) {
    console.error('Error extracting vendor IDs:', error);
    return [];
  }
}

async function updateVendorPriceLevel(page, vendorIds, setToConcert) {
  if (vendorIds.length === 0) {
    console.log('All vendors updated.');
    return;
  }

  try {
    // Navigate to the vendor's edit page
    const vendorId = vendorIds.shift();
    const url = `https://connect.appetizeapp.com/vendors/edit/${vendorId}`;
    await page.goto(url, { waitUntil: 'networkidle0' });
    console.log(`Navigated to ${url}`);

    // Wait for the price level dropdown to appear
    await page.waitForSelector('#activePriceLevelId');

    // Check the current value of the dropdown
    const currentValue = await page.evaluate(() => {
      const select = document.querySelector('#activePriceLevelId');
      return select ? select.value : null;
    });

    console.log(`Current price level value: ${currentValue}`);

    // Determine the desired value based on the boolean
    const desiredValue = setToConcert ? '8524' : '5430'; // Concert Price Level or Default Price Level
    if (currentValue === desiredValue) {
      console.log('Price level is already correct. No changes needed.');
    } else {
      // Update the dropdown selection
      await page.select('#activePriceLevelId', desiredValue);
      console.log(`Updated price level to ${setToConcert ? 'Concert' : 'Default'} Price Level`);
    }

    // Continue with the next vendor ID recursively
    await updateVendorPriceLevel(page, vendorIds, setToConcert);
  } catch (error) {
    console.error('Error updating vendor price level:', error);
  }
}

module.exports = { main };