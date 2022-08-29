const TelegramBot = require('node-telegram-bot-api');
const { exit } = require('process');
const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const screen = {width: 1920,height: 1080};
const axios = require('axios').default;
require('dotenv').config();

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_BOT_API;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

var date = process.argv.slice(2)[0];
if(date == "") return

// Listen for any kind of message. There are different kinds of
// messages.
// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;

//   console.log(msg);

//   // send a message to the chat acknowledging receipt of their message
// //   bot.sendMessage(chatId, 'Received your message');
// });

async function get_matches(){
    var driver = new Builder().forBrowser(Browser.CHROME)
    // .setChromeOptions( new chrome.Options().headless().windowSize(screen))
    .build();

    try {
        
        await driver.manage().setTimeouts( { implicit: 0, pageLoad: 5000, script: null } );

        await driver.get(`https://www.cbssports.com/soccer/champions-league/schedule/${date}/`).catch((err)=>{return err;});

        const MATCHES_TABLE = await driver.wait(until.elementLocated(By.css('TableBase-title--large')), 5000).catch((err)=>{return err;});
    
        if(MATCHES_TABLE instanceof Error){
            console.log("Error Getting matches for this date");
            // driver.quit();
            return
        }

        let matches_count = await driver.findElements(By.css('TableBase-title--large'), 5000).catch((err)=>{return err;});

        if(matches_count instanceof Error){
            console.log("Error login to : ");
            return
        }

        console.log(matches_count);

        console.log("salam");
    } catch (error) {
        console.log(error);
    }
 
}

get_matches();