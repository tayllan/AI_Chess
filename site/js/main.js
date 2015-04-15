window.onload = function() {
	var chess = new Chess();
	var engine = {
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
