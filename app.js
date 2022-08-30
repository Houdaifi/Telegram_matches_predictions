const TelegramBot = require('node-telegram-bot-api');
const { exit } = require('process');
const {Builder, Browser, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const screen = {width: 1920,height: 1080};
require('dotenv').config();
 
const connection = require("./db.congif");
const promisePool = connection.promise();

// replace the value below with the Telegram token you receive from @BotFather
const token = process.env.TELEGRAM_BOT_API;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

var date = process.argv.slice(2)[0];
if(date == "") return;

// Listen for any kind of message. There are different kinds of
// messages.
// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;

//   console.log(msg);

//   // send a message to the chat acknowledging receipt of their message
// //   bot.sendMessage(chatId, 'Received your message');
// });

function split(str, index) {
    const result = [str.slice(0, index), str.slice(index)];
    return result;
}

const [year, MonthAndDay] = split(date, 4);
const [month, day] = split(MonthAndDay, 2);
let game_date = year + "-" + month + "-" + day;

async function get_matches(){
    var driver = new Builder().forBrowser(Browser.CHROME)
    .setChromeOptions( new chrome.Options().headless().windowSize(screen))
    .build();

    try {
        
        await driver.manage().setTimeouts( { implicit: 0, pageLoad: 5000, script: null } );

        await driver.get(`https://www.cbssports.com/soccer/champions-league/schedule/${date}/`).catch((err)=>{return err;});

        let matches_table_xpath = '//table[@class="TableBase-table"]//tbody//tr';

        const MATCHES_TABLE = await driver.wait(until.elementLocated(By.xpath(matches_table_xpath)), 5000).catch((err)=>{return err;});
    
        if(MATCHES_TABLE instanceof Error){
            console.log("Error Getting matches for this date");
            // driver.quit();
            return
        }

        let matches_count = await driver.findElements(By.xpath(matches_table_xpath), 5000);

        var all_teams = [];

        for (let i = 1; i <= matches_count.length; i++) {
            await driver.findElement(By.xpath(`//table[@class="TableBase-table"]//tbody/tr[${i}]//div[@class="TeamLogoNameLockup-name"]//span[@class="TeamName"]`), 5000)
                            .getText()
                            .then((name) => all_teams.push(name));
        }

        // Split teams by 2 and get partidos
        const perChunk = 2;   
        const matches = all_teams.reduce((resultArray, item, index) => { 
            const chunkIndex = Math.floor(index/perChunk);

            // start a new chunk
            if(!resultArray[chunkIndex]) resultArray[chunkIndex] = [];

            resultArray[chunkIndex].push(item);

            return resultArray;
        }, []);

        for (const match of matches) {
            try {
                await promisePool.execute('INSERT INTO matches (game, entered_at, result) VALUES (?,?,?)', [match.join(" VS "), game_date ,"0-0"]);
            } catch (error) {
                console.log(error.message);
            }
        }

        console.log("done");

    } catch (error) {
        console.log(error.message);
    }
 
}

async function check_if_matches_already_exist(date){
    const [rows,fields] = await promisePool.query("SELECT * FROM matches WHERE entered_at = ?", [date]);
    if(rows.length == 0){
        get_matches();
    }

    console.log(rows);
}

// get_matches();
check_if_matches_already_exist(game_date);