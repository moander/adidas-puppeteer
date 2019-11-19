const puppeteer = require('puppeteer');
const fs = require('fs');
const url = require('url');

if (!fs.existsSync('./productLinks.json')) fs.writeFileSync('./productLinks.json', '[]');
if (!fs.existsSync('./products.json')) fs.writeFileSync('./products.json', '[]');

let startUrl = 'https://www.adidas.no/outdoor-sko-menn?v_size_no_no=50';

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
    });
    const page = await browser.newPage();

    let allProductLinks = require('./productLinks.json');

    if (!allProductLinks.length) {
        console.log('Fetching all products..')
        await page.goto(startUrl, { waitUntil: 'networkidle0' });
        while (true) {
            let pageProductLinks = await page.evaluate(() => Array.from(document.querySelectorAll('.gl-product-card-container a[data-auto-id="glass-hockeycard-link"]'), a => a.getAttribute('href')));
            allProductLinks.push(...pageProductLinks);

            let nextElem = await page.$('span[data-auto-id="pagination-right-button"]');
            if (!nextElem) {
                break;
            }
            await nextElem.click({ waitUntil: 'networkidle0' })
        }

        fs.writeFileSync('./productLinks.json', JSON.stringify(allProductLinks, null, 4));
    }
    console.log(`Found ${allProductLinks.length} products`);


    let allProducts = require('./products.json')

    for (let productLink of allProductLinks) {
        let product = allProducts.find(x => x.link === productLink);
        if (!product) {
            product = {
                link: productLink,
                name: url.parse(productLink).pathname.split('/').join('_'),
            }
            await page.goto(product.link, { waitUntil: 'networkidle0' })
            product.sizes = await page.evaluate(() => Array.from(document.querySelectorAll('div[data-auto-id="product-size-dropdown"] .gl-native-dropdown__select-element option'), x => x.innerText).filter(x => x));

            await new Promise(r => setTimeout(r, 500))
            let consent = await page.$('#truste-consent-button');
            consent && consent.click();

            let spam = await page.$('button.gl-modal__close');
            spam && spam.click();

            await new Promise(r => setTimeout(r, 500))
            await page.screenshot({ path: `screenshots/${product.name}.png` });

            allProducts.push(product);
            fs.writeFileSync('./products.json', JSON.stringify(allProducts, null, 4));
            console.log(`Fetched ${product.name}`);
        }
    }

    let productsHtml = [];

    allProducts.forEach(product => {
        if (!product.sizes.some(s => s.includes('50'))) {
            console.log('skip', product.name);
            return;
        }
        productsHtml.push(`
            <a href="${product.link}" target="_blank"><img src="screenshots/${product.name}.png"></a><br>
            ${product.name}
            <hr>
        `)
    });

    fs.writeFileSync('products.html', productsHtml.join(''));


    await browser.close();
})();
