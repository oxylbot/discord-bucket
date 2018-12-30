const zmq = require("zeromq");

class RPCSocket {
	constructor(address) {
		this.address = address;
		this.socket = zmq.socket("router");
		this.socket.on("message", this.message.bind(this));

		this.request = null;
		this.proto = null;
	}

	start(request, proto) {
		this.request = request;
		this.proto = proto;

		this.socket.bind(this.address);
	}

	close() {
		this.socket.close();
	}

	async message(client, message) {
		const request = this.proto.lookupType("RPCRequest");
		const decoded = request.toObject(request.decode(message));

		const requestType = this.proto.lookupType(decoded.requestType);
		decoded.data = requestType.toObject(requestType.decode(decoded.data));

		switch(requestType) {
			case "": {
				// handler here for each one lol
			}
		}

		const responseType = this.proto.lookupType(decoded.responseType);
		const response = this.proto.lookupType("RPCResponse");

		const buffer = response.encode({
			id: decoded.id,
			data: responseType.encode().finish()
		}).finish();

		this.socket.send([client, buffer]);
	}
}

module.exports = RPCSocket;
