const TelegramBot = require('node-telegram-bot-api');
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

// Today date format yyyy-mm-dd
var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var all_commands = ['/partidos_li_majin', '/start_predections', '/edit_a_predection', '/saborat_tartib', '/tawa9o3ati'];

var last_command = "";
var match_id_to_be_edited = 0;

// Listen for any kind of message. There are different kinds of messages.
bot.on('message', async (msg) => {
    let response = "";
    const chatId = msg.chat.id;

    const [year, month, day] = getMatchDate();
    let date = year + month + day;

    var player_id = await get_player_id_by_username(msg.from.username);

    // all reply to command switch handle
    if(last_command !== ""){

        switch (last_command) {
            case '/start_predections':

                if((msg.text).startsWith("/")) break;

                let predection = (msg.text).split("\n");

                if(predection.length > 0){
                    if(typeof predection[0] == "string"){
                        await check_if_matches_already_exist(date)
                        .then(async (matches) => {
                            for (const [i, match] of matches.entries()) {
                                try {
                                    let is_exist = await check_if_player_has_already_fill_the_predections(player_id, match.id);
                                    // If predection already exist
                                    if(is_exist){
                                        await bot.sendMessage(chatId, `Deja 3amarti had Tawa9o3 dyalk for : \n${match.game}`);
                                    }else{
                                        await promisePool.execute('INSERT INTO predections (match_id, player_id, result, is_favourite, points, entered_at) VALUES (?,?,?,?,?, NOW())',
                                        [match.id, player_id, predection[i].trim(), 0, 0]);
                                        // On success send confirm message
                                        await bot.sendMessage(chatId, `Saved, Tawa9o3 dyalk for : \n${match.game} is ${predection[i]}\nBonne chance`);
                                    }
                                } catch (error) {
                                    bot.sendMessage(chatId, "Error, Try Again! with command \n /start_predections");
                                    return error.message;
                                }
                            }
                        });
                    }else{
                        bot.sendMessage(chatId, "Error, Try Again! with command \n /start_predections");
                        return;
                    }
                }
                break;

            case '/edit_a_predection':

                if((msg.text).startsWith("/")) break;

                let new_predection = (msg.text).trim();

                console.log(new_predection, match_id_to_be_edited, player_id);


                if(new_predection.includes("-")){
                    await promisePool.execute('UPDATE predections SET result = ? WHERE match_id = ? AND player_id = ?',
                    [new_predection, match_id_to_be_edited, player_id]);

                    await bot.sendMessage(chatId, `Saved, Tawa9o3 dyalk for match ID : ${match_id_to_be_edited}\n is ${new_predection}\nBonne chance`);

                }else{
                    bot.sendMessage(chatId, "Error, Try Again! with command \n /edit_a_predection");
                    return;
                }

            default:
                break;
        }
    }

    // Save the last command to response to it
    all_commands.includes(msg.text) ? last_command = msg.text : last_command = "";

    // all commands switch handle
    switch (msg.text) {
        case '/partidos_li_majin':

            await bot.sendMessage(chatId, 'Getting games for ' + year + "-" + month + "-" + day + "...");

            await check_if_matches_already_exist(date).then((matches) => {
                if(Array.isArray(matches)){
                    for (const match of matches) {
                        response = response.concat("\n", match.game);
                    }
                }else{
                    response = matches;
                }
            });

            if(response == "") response = "Error please try again";
            bot.sendMessage(chatId, response);
            break;
        
        case '/start_predections':

            bot.sendMessage(chatId, 'Ok, 3amar tawa9o3at dyal ' + year + "-" + month + "-" + day + "\n"
                            + "Please respect the following format for example: \n"
                            + "8-2" + "\n" 
                            + "0-0" + "\n" 
                            + "nata2ij ghaytsjlo b tartib d partidos\n"
                            + "bach tchof partidos li kayn please check command "
                            + "/partidos_li_majin");
            break;

        case '/edit_a_predection':

            let match_ids = []; 

            await check_if_matches_already_exist(date).then((matches) => {
                if(Array.isArray(matches)){
                    for (const match of matches) {
                        response = response.concat("\n", match.id + "-" + match.game);
                        match_ids.push({text: match.id, callback_data: JSON.stringify({'answer': match.id})});
                    }
                }else{
                    response = matches;
                }
            });

            await bot.sendMessage(chatId, "ID - Partido\n" + response);

            await bot.sendMessage(
                chatId,
                'Enter the ID of the game you want to change',
                {
                    reply_markup: {
                        inline_keyboard: [match_ids]
                    }
                }
            );
            break;

        case '/tawa9o3ati':
            
            await get_player_predection(player_id, date).then((predections) => {
                response = "";
                predections.forEach(predection => {
                    response = response.concat("\n", predection.game + " ==> " + predection.result);
                });
            });

            if(response == "") response = "Error, you have no predections for the " + year + "-" + month + "-" + day;
            bot.sendMessage(chatId, response);

        default:
            break;
    }
});

bot.on('callback_query', async (callbackQuery) => {
    let {message, data} = callbackQuery;
    let chatId = message.chat.id;

    match_id_to_be_edited = (JSON.parse(data)).answer;
    await bot.sendMessage(chatId, "Ok, Bayach ghatbdel natija ?\nPlease make sure to be on following format 0-0");
});

function split(str, index) {
    const result = [str.slice(0, index), str.slice(index)];
    return result;
}

function getMatchDate(){
    // Get date for next Tuesday Or Wednesday if today is not Tuesday or Wednesday
    var d = new Date();
    var dayName = days[d.getDay()];

    // If not Today is not Tuesday or Wednesday get the date of the upcoming Tuesday
    if(!["Tuesday", "Wednesday"].includes(dayName)) d.setDate(d.getDate() + (((1 + 8 - d.getDay()) % 7) || 7));
    
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    if(day < 10) day = "0" + day;
    if(month < 10) month = "0" + month;

    return [year, month, day];
}

async function get_player_id_by_username(username){
    let [player,fields] = await promisePool.query("SELECT id FROM players WHERE username = ?", ["@" + username]);
    if(player.length == 0){
        return "No Player with this Username";
    }
    return player[0].id;
}

async function get_matches(date){
    var driver = new Builder().forBrowser(Browser.CHROME)
    .setChromeOptions( new chrome.Options().headless().windowSize(screen))
    .build();

    try {

        const [year, MonthAndDay] = split(date, 4);
        const [month, day] = split(MonthAndDay, 2);
        let game_date = year + "-" + month + "-" + day;

        var d = new Date(game_date);
        var dayName = days[d.getDay()];

        // If it's not Tuesday or Wednesday just exit
        if(!["Tuesday", "Wednesday"].includes(dayName)) return "No upcoming matches";
        
        await driver.manage().setTimeouts( { implicit: 0, pageLoad: 5000, script: null } );

        await driver.get(`https://www.cbssports.com/soccer/champions-league/schedule/${date}/`).catch((err)=>{return err;});

        let matches_table_xpath = '//table[@class="TableBase-table"]//tbody//tr';

        const MATCHES_TABLE = await driver.wait(until.elementLocated(By.xpath(matches_table_xpath)), 5000).catch((err)=>{return err;});
    
        if(MATCHES_TABLE instanceof Error){
            driver.quit();
            return "No upcoming matches";
        }

        let matches_count = await driver.findElements(By.xpath(matches_table_xpath), 5000);
        if(matches_count.length == 0) return "No upcoming matches";

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

        let all_games = [];

        for (const match of matches) {
            try {
                await promisePool.execute('INSERT INTO matches (game, entered_at, result) VALUES (?,?,?)', [match.join(" VS "), game_date ,"0-0"]);
                all_games.push({"game" : match.join(" VS ")});
            } catch (error) {
                return error.message
            }
        }

        return all_games;

    } catch (error) {
        console.log(error.message);
    }
 
}

async function check_if_matches_already_exist(date){
    let game_date = set_game_date(date);

    let [rows,fields] = await promisePool.query("SELECT * FROM matches WHERE entered_at = ?", [game_date]);
    if(rows.length == 0){
        rows = await get_matches(date);
    }

    return rows;
}

function set_game_date(date){
    const [year, MonthAndDay] = split(date, 4);
    const [month, day] = split(MonthAndDay, 2);
    let game_date = year + "-" + month + "-" + day;

    return game_date;
}

async function check_if_player_has_already_fill_the_predections(player_id, match_id){
    
    let [rows] = await promisePool.query("SELECT * FROM predections WHERE player_id = ? AND match_id = ?", [player_id, match_id]);
    if(rows.length == 0){
        return false;
    }

    return true;
}

async function get_player_predection(player_id, date){
    let game_date = set_game_date(date);

    let [rows] = await promisePool.query("SELECT m.game, p.result FROM matches m INNER JOIN predections p ON p.match_id = m.id WHERE player_id = ? AND m.entered_at = ?", [player_id, game_date]);
    if(rows.length == 0){
        return false;
    }

    return rows;
}