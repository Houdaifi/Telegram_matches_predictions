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
var all_commands = ['/partidos_li_majin', '/partidos_li_majin@Tawa9o3at_bot' ,'/start_predections', '/start_predections@Tawa9o3at_bot', 
                    '/edit_a_predection', '/edit_a_predection@Tawa9o3at_bot','/saborat_tartib', '/saborat_tartib@Tawa9o3at_bot',
                    '/tawa9o3ati', '/tawa9o3ati@Tawa9o3at_bot', '/nata2ij_dyali', '/nata2ij_dyali@Tawa9o3at_bot'];

var last_command = "";
var match_id_to_be_edited = 0;

// If it is > 16h on Tuesday or Wednesday return false
function it_is_over_deadline(){
    var current_date = new Date();
    var current_time = current_date.toLocaleTimeString('en-US', { hour12: false });

    var dayName = days[current_date.getDay()];

    const deadline_time = "19:00:00";
    
    if(["Tuesday", "Wednesday"].includes(dayName)){
        if (current_time >= deadline_time){
            return true
        }
    }

    return false;
}

// Listen for any kind of message. There are different kinds of messages.
bot.on('message', async (msg) => {
    let response = "";
    const chatId = msg.chat.id;
    var msg_text = msg.text;
    const player_name = msg.from.first_name + "_" + msg.from.last_name;

    // ignore if msg is not a command or is not contains a slash "/"
    if((msg.hasOwnProperty('entities') && msg.entities[0].type !== 'bot_command') || msg_text.indexOf('/') == -1) return

    // rod l7asana wa sayi2a bi mitliha
    let escaped_msg = msg_text.replace(/[^a-zA-Z_]/g, "");
    let regex;
    if(escaped_msg.match(regex)){
        let answer = escaped_msg.replace(regex, player_name);
        bot.sendMessage(chatId, answer);
        return
    }
   
    return

    if(["/start_predections", "/start_predections@Tawa9o3at_bot", "/edit_a_predection", "/edit_a_predection@Tawa9o3at_bot"].includes(msg_text)){
        if(it_is_over_deadline()){
            await bot.sendMessage(chatId, 'Fat lwa9t a ba dyali, deadline howa 7 d l3chiya');
            bot.sendDocument(chatId, './assets/köksal-baba-trabzonspor.gif');
            return;
        }
    }

    const [year, month, day] = getMatchDate();
    let date = year + month + day;

    var player_id = await get_player_id_by_username(msg.from.username);

    // all reply to command switch handle
    if(last_command !== ""){

        switch (last_command) {
            case '/start_predections':
            case '/start_predections@Tawa9o3at_bot':

                if((msg_text).startsWith("/")) break;

                let predection = (msg_text).split("\n");

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
                                        // if predection in bad format make it = 0-0
                                        if(!(/^\d*-\d*/.test(predection[i]))){
                                            predection[i] = "0-0";
                                        }

                                        await promisePool.execute('INSERT INTO predections (match_id, player_id, result, points, entered_at) VALUES (?,?,?,?, NOW())',
                                        [match.id, player_id, predection[i].trim(), 0]);
                                        // On success send confirm message
                                        await bot.sendMessage(chatId, `Saved, Tawa9o3 dyalk for : \n${match.game} is ${predection[i]}\nBonne chance`);
                                    }
                                } catch (error) {
                                    bot.sendMessage(chatId, "Error, Try Again! with command\n /start_predections\n " + error.message);
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
            case '/edit_a_predection@Tawa9o3at_bot':
                
                if((msg_text).startsWith("/")) break;

                let new_predection = (msg_text).trim();

                if(new_predection.includes("-")){
                    // if predection in bad format make it = 0-0
                    if(!(/^\d*-\d*/.test(new_predection))){
                        new_predection = "0-0";
                    }

                    await promisePool.execute('UPDATE predections SET result = ? WHERE match_id = ? AND player_id = ?',
                    [new_predection, match_id_to_be_edited, player_id]);

                    await bot.sendMessage(chatId, `Saved, Tawa9o3 dyalk for match ID : ${match_id_to_be_edited}\nis ${new_predection}\nBonne chance`);

                }else{
                    bot.sendMessage(chatId, "Error, Try Again! with command \n /edit_a_predection");
                    return;
                }

            default:
                break;
        }
    }

    // Save the last command to response to it
    all_commands.includes(msg_text) ? last_command = msg_text : last_command = "";

    // all commands switch handle
    switch (msg_text) {
        case '/partidos_li_majin':
        case '/partidos_li_majin@Tawa9o3at_bot':

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
        case '/start_predections@Tawa9o3at_bot':

            await bot.sendMessage(chatId, 'Ok, 3amar tawa9o3at dyal ' + year + "-" + month + "-" + day + "\n"
                            + "Please respect the following format for example: \n"
                            + "8-2" + "\n" 
                            + "0-0" + "\n" 
                            + "nata2ij ghaytsjlo b tartib d partidos\n"
                            + "bach tchof partidos li kayn please check command "
                            + "/partidos_li_majin");

            await bot.sendMessage(chatId, '<b>Ay natija machi 3la chakel "8-2" matalan, ghatsjel "0-0"</b> \nChokran 3la tafahomikom', {parse_mode: 'HTML'});

            break;

        case '/edit_a_predection':
        case '/edit_a_predection@Tawa9o3at_bot':

            let match_ids = []; 

            await check_if_matches_already_exist(date).then((matches) => {
                if(Array.isArray(matches)){
                    for (const match of matches) {
                        response = response.concat("\n", match.id + "-" + match.game);
                        match_ids.push([{'text': match.id, 'callback_data': match.id}]);
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
                    'reply_markup': JSON.stringify({
                        inline_keyboard: match_ids
                    })
                }
            );
            break;

        case '/tawa9o3ati':
        case '/tawa9o3ati@Tawa9o3at_bot':
            
            await get_player_predection(player_id, date).then((predections) => {
                if(predections){
                    response = "";
                    predections.forEach(predection => {
                    response = response.concat("\n", predection.game + " ==> " + predection.result);
                    });
                }
            });

            if(response == "") response = "Error, you have no predections for the " + year + "-" + month + "-" + day;
            bot.sendMessage(chatId, response);

            break;

        case '/saborat_tartib':
        case '/saborat_tartib@Tawa9o3at_bot':


            await get_dashboard().then((results) => {
                response = "";
                results.forEach(result => {
                    response = response.concat("\n", (result.lname).toUpperCase() + " ==> " + result.points + " points");
                });
            });

            await bot.sendMessage(chatId, response);
            break;

        case '/nata2ij_dyali':
        case '/nata2ij_dyali@Tawa9o3at_bot':

            await get_players_predections_points_with_notes(player_id).then((game_predections) => {
                response = "";
                game_predections.forEach(game_predection => {
                    response = response.concat("\n", (game_predection.game).toUpperCase() + " finished with ==> " + game_predection.result + " And you got " + game_predection.points + " points 7it ==> " + game_predection.note);
                });
            });
                
            await bot.sendMessage(chatId, response);
            break;

        case '/tawa9o3at_kamlin':
        case '/tawa9o3at_kamlin@Tawa9o3at_bot':

            if(it_is_over_deadline()){
                await get_all_players_predections(date).then((predections) => {
                    let predecs = [];
                    response = "";
                    predections.forEach(predection => {
                        if(!predecs[predection.lname]) predecs[predection.lname] = [];
                        predecs[predection.lname].push({"game" : predection.game, "result": predection.result});
                    });
                
                    for (const player in predecs) {
                        response = response.concat("\n", "<b>" + player.toUpperCase() + "</b>:");
                        predecs[player].forEach(predect => {
                            response = response.concat("\n", predect.game + " ===> " + predect.result);
                        });
                        response = response.concat("\n", "\n---------------");
                    }
                });

                bot.sendMessage(chatId, response, {parse_mode: 'HTML'});
            }else{
                bot.sendMessage(chatId, "Can't show predections before 4h d l3chiya of match day");
                return;
            }

            break;            

        default:
            break;
    }
});

bot.on('callback_query', async (callbackQuery) => {
    return
    if (it_is_over_deadline()) return
    let {message, data} = callbackQuery;
    let chatId = message.chat.id;

    match_id_to_be_edited = JSON.parse(data);

    last_command = "/edit_a_predection";
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

    return [String(year), String(month), String(day)];
}

async function get_player_id_by_username(username){
    let [player] = await promisePool.query("SELECT id FROM players WHERE username = ?", ["@" + username]);
    if(player.length == 0){
        return "No Player with this Username";
    }
    return player[0].id;
}

async function get_matches(date){
    try {
        var driver = new Builder().forBrowser(Browser.CHROME)
                    .setChromeOptions( new chrome.Options().headless().windowSize(screen))
                    .build();

        const [year, MonthAndDay] = split(date, 4);
        const [month, day] = split(MonthAndDay, 2);
        let game_date = year + "-" + month + "-" + day;

        // var d = new Date(game_date);
        // var dayName = days[d.getDay()];

        // If it's not Tuesday or Wednesday just exit
        // if(!["Tuesday", "Wednesday"].includes(dayName)){
        //     driver.quit();
        //     return "No upcoming matches";
        // }
        
        await driver.manage().setTimeouts( { implicit: 0, pageLoad: 5000, script: null } );

        await driver.get(`https://www.cbssports.com/soccer/champions-league/schedule/${date}/`).catch((err)=>{return err;});

        let matches_table_xpath = '//table[@class="TableBase-table"]//tbody//tr';

        const MATCHES_TABLE = await driver.wait(until.elementLocated(By.xpath(matches_table_xpath)), 5000).catch((err)=>{return err;});
    
        if(MATCHES_TABLE instanceof Error){
            driver.quit();
            return "No upcoming matches, Try later";
        }

        let matches_count = await driver.findElements(By.xpath(matches_table_xpath), 5000);
        if(matches_count.length == 0){
            driver.quit();
            return "No upcoming matches, Try later";
        }
        
        var all_games = [];
        var matches = [];

        for (let i = 1; i <= matches_count.length; i++) {
            let rowElements = await driver.findElements(By.xpath(`//table[@class="TableBase-table"]//tbody/tr[${i}]//div[@class="TeamLogoNameLockup-name"]//span[@class="TeamName"]`), 5000);
            let match = [];
            for (let i = 0; i < rowElements.length; i++) {
                let clubname = await rowElements[i].getText()
                match.push(clubname)
            }

            all_games.push(match);
        }
        
        for (const game of all_games) {
            try {
                await promisePool.execute('INSERT INTO matches (game, entered_at, result) VALUES (?,?,?)', [game.join(" VS "), game_date ,"0-0"]);
                matches.push({"game" : game.join(" VS ")});
            } catch (error) {
                driver.quit();
                return error.message
            }
        }

        driver.quit();

        return matches;

    } catch (error) {
        driver.quit();
        console.log(error.message);
    }
 
}

async function check_if_matches_already_exist(date){
    let game_date = set_game_date(date);

    let [rows] = await promisePool.query("SELECT * FROM matches WHERE entered_at = ?", [game_date]);
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

async function get_all_players_predections(date){
    let game_date = set_game_date(date);

    let [rows] = await promisePool.query(`SELECT m.game, p.result, pl.lname FROM matches m 
                                        INNER JOIN predections p ON p.match_id = m.id
                                        INNER JOIN players pl ON p.player_id = pl.id
                                        WHERE m.entered_at = ?
                                        ORDER BY pl.id, m.game`, [game_date]);
    if(rows.length == 0){
        return false;
    }

    return rows;
}

async function get_dashboard(){
    let [results] = await promisePool.query("SELECT id, lname, points FROM players ORDER BY points DESC");
    if(results.length == 0){
        return false;
    }

    return results;
}

function getPastMatchDate(){
    // Get date for past Tuesday Or Wednesday if today is not Tuesday or Wednesday
    var d = new Date();
    var dayName = days[d.getDay()];

    // If not Today is not Tuesday or Wednesday get the date of the past Tuesday
    if(!["Tuesday", "Wednesday"].includes(dayName)) d.setDate(d.getDate() + (((1 - 6 - d.getDay()) % 7) || 7));
    
    let year = d.getFullYear();
    let month = d.getMonth() + 1;
    let day = d.getDate();
    if(day < 10) day = "0" + day;
    if(month < 10) month = "0" + month;

    return [year, month, day];
}

async function get_players_predections_points_with_notes(player_id){
    let [results] = await promisePool.query(`SELECT m.game, m.result, p.points, p.note FROM matches m
                                            INNER JOIN predections p ON p.match_id = m.id 
                                            WHERE p.player_id = ? AND m.entered_at BETWEEN ? AND ?
                                            AND p.points != '0'
                                            ORDER BY points DESC`, [player_id, "2023-02-21", "2023-02-22"]);
    if(results.length == 0){
        return false;
    }

    // console.log(results)

    return results;
}