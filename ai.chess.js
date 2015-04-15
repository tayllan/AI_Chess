var AI_Chess = function() {
	var socket = io.connect('http://localhost:5000');

	var add_competitors = function(data) {
		console.log('Adding competitors', data);
	};

	var competitor_move = function(data) {
		console.log('Competitor made a move', data);
	};

	var ilegal_move = function(data) {
		console.log('Your move is ilegal', data);
	};

	socket.on('message', function(data) {
		var message_type = data.type;
		var data = data.message;

		switch (message_type) {
			case 1:
				add_competitors(data);
				break;
			case 2:
				competitor_move(data);
				break;
			case 3:
				ilegal_move(data);
				break;
			default:
				console.log('Something went wrong here!', data);
		}
	});	

	var send_message = function(message) {
		socket.send(message);
	};

};
