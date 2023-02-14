const connection = require("./db.congif");
const promisePool = connection.promise();

async function calculte_result(date){
    let [games_with_predections] = await promisePool.query(
        `SELECT game, m.result, p.match_id, p.player_id, pl.points, p.result as predection FROM matches m
        INNER JOIN predections p
        ON m.id = p.match_id
        INNER JOIN players pl
        ON pl.id = p.player_id
        WHERE m.entered_at = ?
        ORDER BY p.player_id, p.match_id ASC`,
        [date]);

    if(games_with_predections.length == 0) return;
 
    let players_points = [];

    await games_with_predections.forEach((game) => {
        players_points[game.player_id] = parseInt(game.points);
    });

    games_with_predections.forEach(async (game) => {
        // console.log(game)
        let r_result = (game.result).split("-");
        let p_result = (game.predection).split("-");
        
        if(game.result == game.predection){
            players_points[game.player_id] = parseInt(players_points[game.player_id]) + 3;
            // console.log("Natija exact")
            await promisePool.execute('UPDATE predections SET points = ?, note= ? WHERE match_id = ? AND player_id = ?', [3, "Natija exact" ,game.match_id, game.player_id]);
        }else if(r_result[0] == r_result[1]){
            if(p_result[0] == p_result[1]){
                players_points[game.player_id] = parseInt(players_points[game.player_id]) + 1;
                // console.log("Tawa9o3 Ta3adol")
                await promisePool.execute('UPDATE predections SET points = ?, note= ? WHERE match_id = ? AND player_id = ?', [1, "Tawa9o3 Ta3adol" ,game.match_id, game.player_id]);
            }
        }else if(r_result.indexOf(Math.max(...r_result).toString()) == p_result.indexOf(Math.max(...p_result).toString())){
            if(p_result[0] != p_result[1] ){
                players_points[game.player_id] = parseInt(players_points[game.player_id]) + 1;
                // console.log("Tawa9o3 Fawz")
                await promisePool.execute('UPDATE predections SET points = ?, note= ? WHERE match_id = ? AND player_id = ?', [1, "Tawa9o3 Fawz" ,game.match_id, game.player_id]);
            }
        }
    });

    players_points.forEach(async (player_point, player_id) => {
        await promisePool.execute('UPDATE players SET points = ? WHERE id = ?', [player_point, player_id]);
    });

    console.log("Done");
}

// calculte_result("2022-02-14");