var socket = require('socket.io').listen(5000);
var players = {};
var separator = 'AI_Chess';
var broadcast = function(rest, message) {
	socket.sockets.emit(rest, message);
};
var chess = require('./chess.min.js');

// send everybody the list of players online
var broadcast_players = function() {
	var temp_players = [];

	// the players object has more info than necessary/recommended
	for (var id in players) {
		temp_players.push({
			id: id,
			username: players[id].username,
			engine_url: players[id].engine_url,
			challengeable: players[id].challengeable,
			wins: players[id].wins,
			losses: players[id].losses,
			draws: players[id].draws,
		});
	}

	broadcast('/players', {players: temp_players});
};

var play_match = function(p1, p2) {
	p1.challengeable = false;
	p1.opponent = p2.id;
	p2.challengeable = false;
	p2.opponent = p1.id;
	broadcast_players();
	var board = chess.Chess();

	// TODO: initially only the player suppose to make a move receives the board
	p1.emit('/play', {
		board: board.fen().split(' ')[0],
	});
	
	var something = function(p1, p2) {
		p1.on('/play', function(data) {
			var legal_move = board.move(data.move);
			var fen_string = board.fen().split(' ')[0];

			if (legal_move) {
				if (board.in_checkmate()) {
					p1.wins += 1;
					p2.losses += 1;

					p1.emit('/play', {
						board: fen_string,
						last_move: data.move,
						in_victory: true,
					});
					p2.emit('/play', {
						board: fen_string,
						last_move: data.move,
						in_checkmate: true,
					});
				}
				else if (board.in_draw()) {
					p1.draws += 1;
					p2.draws += 1;

					p1.emit('/play', {
						board: fen_string,
						last_move: data.move,
						in_draw: true,
					});
					p2.emit('/play', {
						board: board.fen().split(' ')[0],
						last_move: data.move,
						in_draw: true,
					});
				}
				else {
					p2.emit('/play', {
						board: fen_string,
						last_move: data.move,
					});
				}
			}
			else {
				p1.emit('/play', {
					board: fen_string,
					last_move: data.move,
					ilegal_move: true,
				});
			}
		});
	};

	something(p1, p2);
	something(p2, p1);
};

socket.on('connection', function(client) {
	var engine_url = client.handshake.headers.host;
	var client_url = engine_url.split('.');
	var aux_length = client_url.length;

	if (aux_length < 2 || (client_url[aux_length - 1] !== 'io' && client_url[aux_length - 2].split('/')[0] !== 'github')) {

		// TODO: uncomment the code below when in 'production' to disconnect 'illegal' client
		//client.disconnect();
		console.log('ILLEGAL URL, DISCONNECT!');
	}

	players[client.id] = client;
	players[client.id].engine_url = engine_url;
	players[client.id].challengeable = true;
	players[client.id].wins = 0;
	players[client.id].losses = 0;
	players[client.id].draws = 0;

	// the client has done viewing the match he was just playing, he's now available to any other challenge
	client.on('/available', function(data) {
		players[client.id].challengeable = true;
		broadcast_players();
	});

	// receives the username of the new player and put him in the list of players
	client.on('/username', function(data) {
		players[client.id].username = data.username;

		// so that the client receives his own ID
		client.emit('/username', {id: client.id});
		broadcast_players();
	});

	// receive the id of the user that Client is challenging to a match
	client.on('/challenge', function(data) {
		var id = data.id;

		// if the challenged player exists, send him the challenge
		if (id in players) {
			players[id].emit('/challenged', {challenger: client.id});
		}
	});

	// receive the answer for the challenge that Client sent someone
	client.on('/challenged', function(data) {
		if (data.accept === true) {
			players[data.challenger].emit('/challenge', {
				accept: true,
				username: players[client.id].username
			});

			play_match(players[data.challenger], players[client.id]);
		}
		else {

			// Client has refused to duel this other player, send him the notice
			players[data.challenger].emit('/challenge', {
				accept: false,
				username: players[client.id].username
			});
		}
	});

	client.on('disconnect', function() {
		if (players[client.id] && players[client.id].challengeable === false) {

			// TODO: fix this bad workaround (probably using rooms or similar)
			players[players[client.id].opponent].challengeable = true;
			players[players[client.id].opponent].wins += 1;
		}

		// Client has disconnected, remove him for the list of players and update everyone else's list
		delete players[client.id];
		broadcast_players();
	});
});
