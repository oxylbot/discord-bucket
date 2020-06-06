const handler = require("./request-handler");
const { Router } = require("zeromq");

class RPCSocket {
	constructor() {
		this.socket = new Router();
		this.messageHandler();

		this.proto = null;
	}

	start(proto) {
		this.proto = proto;

		this.socket.connect(`tcp://discord-bucket-zmq-proxy:${process.env.DISCORD_BUCKET_ZMQ_PROXY_SERVICE_PORT_DEALER}`);
	}

	close() {
		this.socket.close();
	}

	async messageHandler() {
		while(!this.socket.closed) {
			const [proxy, client, message] = await this.socket.receive();
			const request = this.proto.rpc.lookup("Request");
			const decoded = request.decode(message);

			const requestType = this.proto.discord.lookup(decoded.requestType);
			const result = await handler(decoded.name, requestType.decode(decoded.data));

			const responseType = this.proto.discord.lookup(result.responseType);
			const verifyError = responseType.verify(result.data);
			if(verifyError) throw new Error(verifyError);

			const buffer = this.proto.rpc.lookup("Response").encode({
				id: decoded.id,
				responseType: result.responseType,
				data: responseType.encode(responseType.fromObject(result.data)).finish()
			}).finish();

			await this.socket.send([proxy, client, buffer]);
		}
	}
}

module.exports = RPCSocket;
