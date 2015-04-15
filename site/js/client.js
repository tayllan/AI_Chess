var element_players_list = document.getElementById('players-list');
var board = new ChessBoard('board', 'start');
var board_helper = new Chess();

function _(engine) {
	var _html = {
		get_username: function() {
			return prompt('Type your username: ');
		},
		alert_draw: function() {
			alert('It\'s a draw!');
		},
		alert_loss: function() {
			alert('You lost!');
		},
		alert_winning: function() {
			alert('You won!');
		},
		alert_ilegal_move: function() {
			alert('That\'s a ilegal move!');
		},
		alert_challenge: function(username) {
			return confirm(username + ' is challenging your to a match! IT IS ON!');
		},
		alert_challenge_accepted: function(username) {
			alert('IT IS ON');
		},
		alert_challenge_refused: function(username) {
			alert(username + ' has refused to duel you!');
		},
		render_board: function(fen_string) {
			board = new ChessBoard('board',	fen_string);
		},
		render_players_list: function(players_list, event_listener_fn) {
			element_players_list.innerHTML = '';

			players_list.forEach(function(element, index, array) {
				var child = null;

				if (element.challengeable === true) {
					child = document.createElement('a');
					child.href = element.id;
					child.addEventListener('click', event_listener_fn);
					element_players_list.appendChild(document.createElement('br'));
				}
				else {
					child = document.createElement('p');
				}

				child.innerHTML = 'Player: ' + element.username + '. Wins: ' + element.wins + '; Losses: ' + element.losses + '; Draws: ' + element.draws + '; Engine: ' + element.engine_url;
				element_players_list.appendChild(child);
			});
		},
	};
	var username = _html.get_username();
	var socket = io.connect('http://localhost:5000');
	var players_list = [];
	var my_id = null;
	
	socket.emit('/username', {username: username});
	socket.on('/username', function(data) {
		my_id = data.id;
	});

	socket.on('/players', function(data) {
		players_list = data.players;
		_html.render_players_list(players_list, function(event) {
			event.preventDefault();

			var aux = event.target.href.split('/');
			var challenged_id = aux[aux.length - 1];

			if (challenged_id === my_id) {
				alert('You can\'t challenge yourself!');
			}
			else {
				socket.emit('/challenge', {id: challenged_id});
			}

			return false;
		});
	});

	socket.on('/challenged', function(data) {
		var challenger_id = data.challenger;

		players_list.forEach(function(element, index, array) {
			if (element.id === challenger_id) {
				var c = _html.alert_challenge(element.username);

				if (c) {
					board_helper = new Chess();
					socket.emit('/challenged', {
						accept: true,
						challenger: challenger_id,
						username: username
					});
				}
				else {
					socket.emit('/challenged', {
						accept: false,
						challenger: challenger_id,
						username: username
					});
				}
			}
		});
	});

	socket.on('/challenge', function(data) {
		if (data.accept === false) {
			_html.alert_challenge_refused(data.username);
		}
		else {
			board_helper = new Chess();
			_html.alert_challenge_accepted(data.username);
		}
	});

	socket.on('/play', function(data) {
		_html.render_board(data.board);

		if (data.ilegal_move) {
			console.log(board_helper.fen());
			console.log(data);
			_html.alert_ilegal_move();
			engine.new_game();
		}
		else if (data.in_checkmate) {
			_html.alert_loss();
			engine.new_game();
		}
		else if (data.in_draw) {
			_html.alert_draw();
			engine.new_game();
		}
		else if (data.in_victory) {
			_html.alert_winning();
			engine.new_game();
		}
		else {
			board_helper.move(data.last_move);
			var move = engine.next_move(data.last_move);
			board_helper.move(move);
			board.position(board_helper.fen());

			socket.emit('/play', {move: move});
		}
	});
};
