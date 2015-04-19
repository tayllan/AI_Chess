var socket = require('socket.io').listen(5000);
var players = {};
var separator = 'AI_Chess';
var broadcast = function(rest, message) {
	socket.sockets.emit(rest, message);
};
var chess = require('./chess.min.js');
var rooms = {};

// TODO: maybe put this on a separate file (helper functions and such)
var Room = function(p1_id, p2_id, room_id) {
	this.p1_id = p1_id;
	this.p2_id = p2_id;
	this.id = room_id;
	this.finished_match = false;
	this.remove_player = function(p_id) {
		if (this.p1_id && this.p1_id.id === p_id) {
			delete this.p1_id;
		}
		else if (this.p2_id && this.p2_id.id === p_id) {
			delete this.p2_id;
		}
	};
	this.are_there_players = function() {
		return (this.p1_id || this.p2_id) ? true : false;
	};
	this.get_other_player_id = function(p_id) {
		if (this.p1_id === p_id && this.p2_id) {
			return p2_id;
		}
		else if (this.p2_id === p_id && this.p1_id) {
			return p1_id;
		}
		else {
			return null;
		}
	};
};
var available_characters = [
	'0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
	'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
	'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
	'u', 'v', 'w', 'x', 'y', 'z', '!', '@', '#', '$',
	'%', '"&', '*', '(', ')'
];
var generate_random_id = function(size) {
	size = size || 30;
	var random_id = '';

	for (; size--; ) {
		random_id += available_characters[Math.floor(Math.random() * available_characters.length)]
	}
	
	return random_id;
};

// send everybody the list of players online
var broadcast_players = function() {
	var temp_players = [];

	// the players object has more info than necessary/recommended
	for (var id in players) {
		temp_players.push({
			id: id,
			username: players[id].username,
			engine_url: players[id].engine_url,
			challengeable: (players[id].room_id) ? false : true,
			wins: players[id].wins,
			losses: players[id].losses,
			draws: players[id].draws,
		});
	}

	broadcast('/players', {players: temp_players});
};

var play_match = function(p1, p2) {
	var room_id = generate_random_id();
	while (room_id in rooms) {
		room_id = generate_random_id();
	}
	p1.room_id = room_id;
	p2.room_id = room_id;
	broadcast_players();
	var board = chess.Chess();

	rooms[room_id] = new Room(p1.id, p2.id, room_id);

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
					rooms[room_id].finished_match = true;

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
					rooms[room_id].finished_match = true;

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
	players[client.id].wins = 0;
	players[client.id].losses = 0;
	players[client.id].draws = 0;

	// the client has done viewing the match he was just playing, he's now available to another challenge
	client.on('/available', function(data) {
		var temp_room_id = players[client.id].room_id;

		rooms[temp_room_id].remove_player(client.id);
		if (rooms[temp_room_id].are_there_players()) {
			delete rooms[temp_room_id];
		}

		delete players[client.id].room_id;
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
		var c_i = client.id;

		// if the disconnecting player is still on a match, the other player automatically wins
		console.log(rooms);
		console.log(players[c_i].room_id);
		if (players[c_i].room_id && !rooms[players[c_i].room_id].finished_match) {
			var other_player_id = rooms[players[c_i].room_id].get_other_player_id(c_i);
			
			players[other_player_id].wins += 1;
			delete players[other_player_id].room_id;
			delete rooms[players[c_i].room_id];
			players[other_player_id].emit('/disconnection', {username: players[c_i].username});
		}

		// Client has disconnected, remove him for the list of players and update everyone else's list
		delete players[c_i];
		broadcast_players();
	});
});
