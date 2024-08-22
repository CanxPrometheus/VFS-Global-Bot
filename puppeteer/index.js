const puppeteer = require('puppeteer-extra');
const proxyPlugin = require('puppeteer-extra-plugin-proxy');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { TurnstileTask } = require("node-capmonster");
const axios = require("axios");
const client = new TurnstileTask("4eca70d694df66f37dc0642ef5a58fc5");
const { getLastMail, extractOTP } = require("./mail");
const { ExecuteSql } = require("../db");
const { ODEME_BILGILERI } = require("../config.json");

puppeteer.use(StealthPlugin());
const proxyHost = 'server9.livaproxy.com';
const proxyPort = 50652;
const proxyUsername = '7WRQ58S4';
const proxyPassword = '7WRQ58S4';
puppeteer.use(
  proxyPlugin({
    address: proxyHost,
    port: proxyPort,
    credentials: {
      username: proxyUsername,
      password: proxyPassword,
    }
  })
);

const {TelegramLog} = require('../telegram');

function delay(time) {
  return new Promise(function(resolve) { 
    setTimeout(resolve, time)
  });
}
function generateRandomCode() {
  const prefix = 'FRA'; // Sabit olan ilk 3 karakter
  const middleNumbers = Math.floor(1000000000 + Math.random() * 9000000000); // Rastgele 10 haneli sayı
  const suffix = Math.floor(1000 + Math.random() * 9000); // Rastgele 4 haneli sayı

  return prefix + middleNumbers + suffix;
}
async function waitForLoadingDiv(page) {        
  await page.waitForSelector('.ngx-overlay.loading-foreground', { timeout: 30000 });
  await page.waitForSelector('.ngx-overlay:not(.loading-foreground)', { timeout: 60000 });
}

async function waitForWidgetId(page) {
  await page.waitForFunction(() => {
      return window.widgetId !== undefined;
  }, { timeout: 30000 });

  return await page.evaluate(() => window.widgetId);
}

async function selectDropdown(page, text) {
  await page.evaluate((text) => {
      const elements = Array.from(document.querySelectorAll('mat-option'));
      const targetElement = elements.find(element => element.innerText.includes(text));
      if (targetElement) {
          targetElement.click();
      }
  }, text);
}

async function typeToInput(page, placeholder, text, index = 1) {
  const inputSelector = `input[placeholder="${placeholder}"]`;
  try {
    await page.waitForSelector(inputSelector, {timeout: 2000});
  } catch (error) {
    return;
  }

  const elements = await page.$$(inputSelector);
  if (elements.length < index) {
    throw new Error(`There are only ${elements.length} elements with placeholder "${placeholder}", but you requested index ${index}`);
  }

  if (placeholder === "OTP") {
    await page.evaluate((sifre) => {
      const textArea = document.querySelector('input[placeholder="OTP"]');
      textArea.value = sifre;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    return;
  }

  const element = elements[index - 1];
  await element.focus();

  const delay = 100;
  for (const char of text) {
    await page.keyboard.type(char, { delay });
  }
}

async function openDropdown(page, keyword) {
  await page.evaluate((keyword) => {
      const elements = Array.from(document.querySelectorAll('div.ng-star-inserted'));
      
      for (let element of elements) {
          if (element.innerText.includes(keyword)) {
              const dropdown = element.closest('app-dropdown');
              if (dropdown) {
                  const matFormField = dropdown.querySelector('mat-form-field');
                  if (matFormField) {
                      const matSelectTrigger = matFormField.querySelector('div.mat-select-trigger');
                      if (matSelectTrigger) {
                          matSelectTrigger.click();
                          break;
                      }
                  }
              }
          }
      }
  }, keyword);
}

userAgents = [
  // Google Chrome
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/605.1.15",

  // Mozilla Firefox
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0",

  // Microsoft Edge
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.64",
];


// async function typeWithCustomKeyboard(page, text) {
//   // Harfleri ve özel karakterleri tıklatan fonksiyon
//   async function clickKey(character) {
//       const shiftCharacters = "!@#$%^&*()";
//       const isUpperCase = character === character.toUpperCase() && isNaN(character) && !shiftCharacters.includes(character);
//       const requiresShift = isUpperCase || shiftCharacters.includes(character);
//       const key = requiresShift && !isUpperCase ? character : character.toLowerCase();

//       if (requiresShift) {
//         await page.click('button.mat-keyboard-key-shift');
//         await delay(1000);
//         console.log(await page.content());
//       }

//       const rows = await page.$$('.mat-keyboard-row.ng-star-inserted');
//       let found = false;
//       for (const row of rows) {
//           const buttons = await row.$$('button');
//           for (const button of buttons) {
//               const buttonText = await page.evaluate(el => el.textContent.trim(), button);
//               console.log(buttonText, key);
//               if (buttonText === key) {
//                   await button.click();
//                   await delay(100);
//                   found = true;
//                   break;
//               }
//           }
//           if (found) break;
//       }

//       if (requiresShift) {
//         await page.click('button.mat-keyboard-key-shift');
//         await delay(1000);
//       }
//   }

//   for (const char of text) {
//       await clickKey(char);
//   }
// }

let proxyattempt = 2;

async function tryAppointment(kisiler, details) {
  if (proxyattempt >= 2) {
    var options = {
      method: 'POST',
      url: 'https://livacloud.com/api/v2/rotate.php',
      params: {
        PROXY: 'server9.livaproxy.com:50652',
        API_KEY: '5fc5ec268bdf42cab28c45eee3cd3e1b'
      },
      headers: {'User-Agent': 'insomnia/9.3.2'}
    };
    try {
      const response = await axios.request(options);
      if (response.data.status) {
        proxyattempt = 0;
        console.log("Proxy yenilendi");
      }
    } catch (error) {
      console.error("Proxy yenileme hatası:", error);
    }
  }
  proxyattempt = proxyattempt + 1
  const cardinformations = ODEME_BILGILERI[parseInt(details.paymentinfoindex)];
  let browser = null;
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--single-process',
        '--no-zygote',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-webrtc',
        `--user-agent=${randomUserAgent}`
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(randomUserAgent);

    const width = 1920;
    const height = 980;
    await page.setViewport({ width, height });


    const allowPermissions = ['clipboard-read', 'clipboard-write'];

    await page.goto('https://visa.vfsglobal.com/tur/tr/fra/login', {
      waitUntil: 'networkidle2',
    });
  
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://visa.vfsglobal.com', allowPermissions);

    console.log("ISLEM DEWAMKEE..");
    await page.evaluate(() => {
      window.widgetId = undefined;
      window.addEventListener("message", (t) => {
          if (t.data.event === "init") {
              window.widgetId = t.data.widgetId;
          }
        });
    });

    


    const widgetId = await waitForWidgetId(page);

    await delay(1500);
    await page.waitForSelector("#mat-input-0");
    await page.type("#mat-input-0", "mehmet@schengenvizeal.com");
        
    try {
      await page.waitForSelector("#onetrust-reject-all-handler", {timeout: 5000});
      await page.click("#onetrust-reject-all-handler");
    } catch (error) {
      
    }
  
    await page.evaluate((sifre) => {
      const textArea = document.getElementById('mat-input-1');
      textArea.value = sifre;
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }, "FatihMert321@!");
    
    const task = client.task({
      websiteKey: "0x4AAAAAAACYaM3U_Dz-4DN1",
      websiteURL: page.url(),
    });

    const taskId = await client.createWithTask(task)
    const result = await client.joinTaskResult(taskId)

    await page.evaluate((widgetId, token)=>{
      const t = new MessageEvent("message",{
        data: {
            custom: !0,
            event: "complete",
            source: "cloudflare-challenge",
            token: token,
            widgetId: widgetId
        },
        origin: "https://challenges.cloudflare.com"
      });
      window.dispatchEvent(t);
    }, widgetId, result.token)


    await delay(500);
    await page.click("body > app-root > div > div > app-login > section > div > div > mat-card > form > button");

    await page.waitForNavigation();
    await waitForLoadingDiv(page);
    await delay(1500)
    await page.click("body > app-root > div > div > app-dashboard > section.container.py-15.py-md-30.d-block.ng-star-inserted > div > div.position-relative > div > button")
    await delay(500);
    await waitForLoadingDiv(page);
    await delay(1500);
    await page.click("#mat-select-0");
    await delay(500)
    await selectDropdown(page, details.basvurumerkezi);
    await waitForLoadingDiv(page);
    await delay(1500);
    await page.click("#mat-select-4");
    await delay(500);
    await selectDropdown(page, details.basvurukategori);
    await waitForLoadingDiv(page);
    await delay(1500);
    await page.click("#mat-select-value-3");
    await delay(500);
    await selectDropdown(page, details.basvurualtkategori || "");
    // await waitForLoadingDiv(page);
    await delay(4000);

    
    const isDisabled = await page.evaluate(() => {
      const button = document.querySelector('body > app-root > div > div > app-eligibility-criteria > section > form > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.mt-20.shadow-none > button');
      return button.disabled;
    });
    if (isDisabled) {
      TelegramLog("GENEL", "Boşluk bulunamadı");
      browser.close();
      return false;
    }
    await page.click("body > app-root > div > div > app-eligibility-criteria > section > form > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.mt-20.shadow-none > button");
    await waitForLoadingDiv(page);
    await waitForLoadingDiv(page);
    await delay(3000);

    for (let index = 0; index < kisiler.length; index++) {
      const kisi = kisiler[index];
      if (index > 0) {
        
        await delay(15000);
        await page.click("body > app-root > div > div > app-applicant-details > section > mat-card:nth-child(1) > div.text-right.mt-20.mb-15.ng-star-inserted > button");
        await waitForLoadingDiv(page);
        await delay(1000);
      }
      await typeToInput(page, "İsminizi Giriniz", kisi.name);
      await typeToInput(page, "Lütfen soy isminizi giriniz.", kisi.lastname);
      await typeToInput(page, "GG/AA/YYYY", kisi.birth_date);
      await typeToInput(page, "GG/AA/YYYY", kisi.passport_expiry, 2);
      await typeToInput(page, "pasaport Numarası Giriniz", kisi.passport_number);
      await typeToInput(page, "Referans numaranızı giriniz", generateRandomCode());
      await typeToInput(page, "44", kisi.area_code);
      await typeToInput(page, "012345648382", kisi.phone_number);
      await typeToInput(page, "Mail Adresi Giriniz", kisi.email);

      
      
      await openDropdown(page, "Cinsiyet");
      delay(500)
      await selectDropdown(page, kisi.gender)
  
      await openDropdown(page, "Uyruk");
      delay(500)
      await selectDropdown(page, kisi.nationality);
  
      await delay(20000)
      await page.click("body > app-root > div > div > app-applicant-details > section > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.shadow-none.ng-star-inserted > app-dynamic-form > div > div > app-dynamic-control > div > div > div:nth-child(2) > button");
  
      await waitForLoadingDiv(page);
    }

    


    // BASVURU EKLE BUTON
    // await page.click("body > app-root > div > div > app-applicant-details > section > mat-card:nth-child(1) > div.text-right.mt-20.mb-15.ng-star-inserted > button");

    await delay(1000);
    await page.click("body > app-root > div > div > app-applicant-details > section > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.shadow-none.ng-star-inserted > div.row > div:nth-child(2) > button")

    let now = new Date().getTime();
    await delay(1500);

    await page.click("body > app-root > div > div > app-applicant-details > section > mat-card > mat-card > div > div > button");


    await waitForLoadingDiv(page);
    let otpcode = null;
    let endTime = now + 180000;
    
    TelegramLog("SUCCESS", "OTP KOD BEKLENIYOR...");
    while (!otpcode && new Date().getTime() < endTime) {
      const mail = await getLastMail();
      if (mail.timestamp < now) {
        await delay(3000);
      } else {
        otpcode = extractOTP(mail.mail);
      }
    }
    
    if (!otpcode) {
      TelegramLog("GENEL", "OTP KOD 180 SANIYE SONUNDA GELMEDİ");
      console.log('OTP code retrieval timed out');
      browser.close();
      return false;
    } else {
      await typeToInput(page, "OTP", otpcode);
      await delay(1000);
      await page.click("body > app-root > div > div > app-applicant-details > section > mat-card > mat-card > div > div.row.align-items-end.mt-20.ng-star-inserted > div.col-12.col-sm-3.col-lg-2.my-15.my-sm-0 > button")
      await waitForLoadingDiv(page);
    }

    await delay(1000);
    await page.click("body > app-root > div > div > app-applicant-details > section > mat-card > div.row > div:nth-child(2) > button");
    await waitForLoadingDiv(page);
    await delay(2000);

    const findAndClickAvailableDate = async () => {
      const availableDateSelector = 'td.fc-daygrid-day.fc-day.fc-day-future.date-availiable';
  
      const availableDates = await page.$$(availableDateSelector);
  
      if (availableDates.length > 0) {
        await availableDates[0].click();
        return true;
      }
      return false;
    };
  
    const goToNextPage = async () => {
      const nextButtonSelector = 'body > app-root > div > div > app-book-appointment-split-slot > section > mat-card:nth-child(1) > div.ba-calender-card.card.shadow-sm > div > div > full-calendar > div.fc-header-toolbar.fc-toolbar > div:nth-child(3) > div > button.fc-next-button.fc-button.fc-button-primary';
      await page.click(nextButtonSelector);
      await delay(2000);
    };
  
    const findDateInNextThreePages = async () => {
      for (let i = 0; i < 3; i++) {
        const found = await findAndClickAvailableDate();
        if (found) {
          return true;
        }
        await goToNextPage();
      }
      return false;
    };
  
    const dateFoundAndSelected = await findDateInNextThreePages();
  
    if (dateFoundAndSelected) {
      console.log('Available date found and selected');
    } else {
      TelegramLog("GENEL", "GÜN BULUNAMADI");
      browser.close();
      return false;
    }

    await waitForLoadingDiv(page);
    await delay(1000);


    const slots = await page.$$eval('.hidden-item.ng-star-inserted', rows => {
      return rows.map(row => {
        const time = row.querySelector('.align-middle').innerText;
        const radioButton = row.querySelector('.ba-slot-radio');
        return { time, radioButtonId: radioButton ? radioButton.id : null };
      });
    });
  

    for (const slot of slots) {
      if (slot.radioButtonId) {
        await page.click(`#${slot.radioButtonId}`);
        console.log(`${slot.time} slotu seçildi.`);
        TelegramLog("SUCCESS", "GÜN VE SAAT SEÇİLDİ");
        slotSelected = true;
        break;
      }
    }
    
    if (!slotSelected) {
      TelegramLog("GENEL", "SAAT BULUNAMADI");
      browser.close();
      return false;
    }

    await delay(1000);

    await page.click("body > app-root > div > div > app-book-appointment-split-slot > section > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.shadow-none > div > div:nth-child(2) > button");

    await waitForLoadingDiv(page);
    await delay(3000);
    await page.click("body > app-root > div > div > app-manage-service > section > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.shadow-none > div > div:nth-child(2) > button");
    await waitForLoadingDiv(page);
    await delay(3000);
    const checkboxSelector = 'mat-checkbox:first-of-type';
    await page.waitForSelector(checkboxSelector);
    await page.click(checkboxSelector);
    await delay(1000);
    await page.click("body > app-root > div > div > app-review-and-payment > section > form > mat-card.mat-card.mat-focus-indicator.form-card.p-0.border-0.shadow-none > div > div:nth-child(2) > button");
    await delay(1000);
    TelegramLog("SUCCESS", "ÖDEME SAYFASINA GELİNDİ")
    await delay(1000);
    TelegramLog("SUCCESS", "ÖDEME SAYFASINA GELİNDİ")
    await delay(1000);
    TelegramLog("SUCCESS", "ÖDEME SAYFASINA GELİNDİ")
    await delay(1000);
    await page.click("body > app-root > div > div > app-review-and-payment > section > mat-card > div.row > div:nth-child(2) > button");

    await page.waitForNavigation();

    // await page.type('input[name="pan"]', "444")
    // await page.type('input[name="cv2"]', "321")
    console.log(cardinformations)
    await page.waitForSelector("input[name=pan]");
    await page.type("input[name=pan]", cardinformations.card.number);
    await page.type("input[name=cv2]", cardinformations.card.cvv);
    await page.type("input[name=Fismi]", cardinformations.person.fullname);
    await page.type("input[name=Fadres]", cardinformations.person.address);
    await page.type("input[name=Fadres2]", cardinformations.person.postalcode);
    await page.select("select[name=Ecom_Payment_Card_ExpDate_Month]", cardinformations.card.month);
    await page.select("select[name=Ecom_Payment_Card_ExpDate_Year]", cardinformations.card.year);

    let keepRunning = true;

    browser.on('disconnected', () => {
      console.log('Browser closed');
      keepRunning = false;
    });

    // setTimeout(async() => {
    //   console.log('2 minutes have passed');
    //   await browser.close();
    //   keepRunning = false;
    // }, 1000*60*2);

    while (keepRunning) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    
    return false;

  } catch (error) {
    await browser.close();
    console.error('Failed to load the page:', error);
    return false;
  }
}

const checkAppointment = async () => {
  try {
    const queue = await getQueueList();
    if (!queue[0]) {
      return;
    }
    console.log("===================================================");
    console.log("ISLEM BASLIYOR..");
    await tryAppointment(queue[0].persons, queue[0].details);
  } catch (error) {
    console.error('An error occurred while trying to make an appointment:', error);
  } finally {
    await delay(2000)
    checkAppointment();
  }
};

async function getQueueList() {
  const rawQueue = await ExecuteSql("SELECT * FROM queue ORDER BY id ASC");
  let queue = [];
  for (const queueItem of rawQueue) {
      const details = JSON.parse(queueItem.visadetails);
      const customers = JSON.parse(queueItem.customers);
      let nowqu = {
          id: queueItem.id,
          persons: [

          ],
          details: {
              basvurumerkezi: details.basvurumerkezi,
              basvurukategori: details.basvurukategori,
              basvurualtkategori: details.basvurualtkategori,
              paymentinfoindex: details.paymentinfoindex
          }
      }
      for (const customerId of customers) {
          const user = await ExecuteSql("SELECT * FROM customers WHERE id = ?", [customerId]);
          nowqu.persons.push(user[0]);
      }
      queue.push(nowqu);
  }
  return queue;
}

checkAppointment();