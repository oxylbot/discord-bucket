const zmq = require("zeromq");

class BucketSocket {
	constructor(address) {
		this.socket = zmq.socket("dealer");
		this.socket.on("message", this.message.bind(this));
		this.address = address;

		this.proto = null;
		this.waiting = new Map();
	}

	start(proto) {
		this.proto = proto;
		this.request = proto.lookupService("DiscordAPI")
			.create(this.rpc.bind(this), false, false);

		this.socket.connect(this.address);
	}

	close() {
		this.socket.close();
	}

	rpc(method, data, callback) {
		const id = (Date.now() + process.hrtime().reduce((a, b) => a + b)).toString(36);

		const request = this.proto.lookupType("RPCRequest");
		const buffer = request.encode({
			requestType: method.requestType,
			responseType: method.responseType,
			id: id,
			data: data
		}).finish();

		this.socket.send(buffer);
		this.waiting.set(id, response => {
			this.waiting.delete(id);
			return callback(null, response);
		});
	}

	message(message) {
		const response = this.proto.lookupType("RPCResponse");
		const decoded = response.toObject(response.decode(message));

		if(this.waiting.has(decoded.id)) this.waiting.get(decoded.id)(decoded.data);
	}
}

module.exports = BucketSocket;
