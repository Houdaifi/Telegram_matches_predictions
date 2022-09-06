const connection = require("./db.congif");
const promisePool = connection.promise();

async function calculte_result(date){
    let [games_with_predections] = await promisePool.query(
        `SELECT game, m.result, p.match_id, p.player_id, p.result as predection FROM matches m
        INNER JOIN predections p
        ON m.id = p.match_id
        WHERE m.entered_at = ? 
        ORDER BY p.player_id, p.match_id ASC
        LIMIT 10`,
        [date]);

    if(games_with_predections.length == 0){
        return;
    }

    let players_points = [];

    games_with_predections.forEach(game => {
        if(game.result == game.predection){
            players_points[game.player_id] = (players_points[game.player_id] || 0) + 3;
        }else{
            let results= (game.result).split("-");

            console.log(results)
        }
    });

    console.log(players_points);

}

calculte_result("2022-09-06");