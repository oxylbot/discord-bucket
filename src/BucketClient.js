const zmq = require("zeromq");

class BucketSocket {
	constructor(address) {
		this.socket = zmq.socket("dealer");
		this.socket.on("message", this.message.bind(this));
		this.address = address;

		this.service = null;
		this.proto = null;
		this.waiting = new Map();
	}

	start(proto) {
		this.proto = proto;
		this.service = proto.discord.lookup("DiscordAPI")
			.create(this.rpc.bind(this), false, false);

		this.socket.connect(this.address);
	}

	close() {
		this.socket.close();
	}

	rpc(method, data, callback) {
		const id = (Date.now() + process.hrtime().reduce((a, b) => a + b)).toString(36);

		const request = this.proto.rpc.lookup("Request");
		const buffer = request.encode({
			id: id,
			name: method.name,
			requestType: method.requestType,
			data: data
		}).finish();

		this.socket.send(buffer);
		this.waiting.set(id, response => {
			this.waiting.delete(id);
			if(response.responseType === "discord.types.HTTPError") {
				const httpError = this.proto.discord.lookup("discord.types.HTTPError").decode(response.data);

				const error = new Error(httpError.message);
				error.code = httpError.code;
				error.status = httpError.status;

				return callback(error, null);
			} else {
				return callback(null, response.data);
			}
		});
	}

	async request(type, data = {}) {
		return await this.service[type](data);
	}

	message(message) {
		const response = this.proto.rpc.lookup("Response");
		const decoded = response.decode(message);

		if(this.waiting.has(decoded.id)) this.waiting.get(decoded.id)(decoded);
	}
}

module.exports = BucketSocket;
