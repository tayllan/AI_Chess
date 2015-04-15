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
	render_board: function(fen_string) {
		var board = new ChessBoard('board',	fen_string);
	},
};

function _(engine) {
	var element_players_list = document.getElementById('players-list');
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

		element_players_list.innerHTML = '';

		players_list.forEach(function(element, index, array) {
			var child = null;

			if (element.challengeable === true) {
				child = document.createElement('a');
				child.href = element.id;
				element_players_list.appendChild(document.createElement('br'));
			}
			else {
				child = document.createElement('p');
			}

			child.innerHTML = 'Player: ' + element.username + '. Wins: ' + element.wins + '; Losses: ' + element.losses + '; Draws: ' + element.draws;
			element_players_list.appendChild(child);
		});
	});

	socket.on('/challenged', function(data) {
		var challenger_id = data.challenger;

		players_list.forEach(function(element, index, array) {
			if (element.id === challenger_id) {
				var c = confirm(element.username + ' is challenging your to a match! IT IS ON!');

				if (c) {
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

	element_players_list.addEventListener('click', function(event) {
		if (event.target.tagName.toLowerCase() === 'a') {
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
		}
	});

	socket.on('/challenge', function(data) {
		if (data.accept === false) {
			alert(username);
			alert(data.username + ' has refused to duel you!');
		}
		else {
			alert('IT IS ON');
		}
	});

	socket.on('/play', function(data) {
		_html.render_board(data.board);

		if (data.ilegal_move) {
			_html.alert_ilegal_move();
		}
		else if (data.in_checkmate) {
			_html.alert_loss();
		}
		else if (data.in_draw) {
			_html.alert_draw();
		}
		else {
			var move = engine.next_move(data.last_move);

			//socket.emit('/play', {move: move});
		}
	});
};
