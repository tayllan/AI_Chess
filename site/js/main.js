window.onload = function() {

	// Dummy engine, just for testing purposes
	var chess = new Chess();
	var engine = {
		new_game: function() {
			chess = new Chess();
		},
		next_move: function(last_move) {
			chess.move(last_move);
			var moves = chess.moves();
			var move = null;

			if (chess.turn() === 'b') {
				move = moves[0];
			}
			else {
				move = moves[Math.floor(Math.random() * moves.length)];
			}

			chess.move(move);
			return move;
		},
	};

	_(engine);
};
