const routeRegex = /([a-z-]+)\/(?:\d{17,21}\/[A-Za-z0-9_]{64,}|\d{17,21}|[A-Za-z0-9_]{2,16}:\d{17,21}|[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}])/gu; // eslint-disable-line max-len
// parameter/(webhook_id/webhook_token|id|emoji_name:emoji_id|unicode emoji)

module.exports = async (redis, request) => {
	let route = request.url.replace(routeRegex, (match, type) => {
		if(["channels", "guilds"].includes(type)) return match;
		else if(type === "webhooks") return `${match.split("/").slice(0, -1).join("/")}/token`;
		else return `${type}/id`;
	}).substring(request.url.indexOf("api") + 4);

	if(route.endsWith("/messages/id") && request.method === "DELETE") route += `${request.method} ${route}`;

	const response = await request.ok(res => true);

	if(response.headers["X-RateLimit-Global"] === "true") {
		await redis.set("global", "true", "PX", parseInt(response.headers["Retry-After"]));
	}

	if(response.headers["X-RateLimit-Limit"]) {
		await redis.set(`${route}:limit`, parseInt(response.headers["X-RateLimit-Limit"]), "PX", 900000);
	}

	if(response.headers["X-RateLimit-Remaining"]) {
		await redis.set(`${route}:remaining`, parseInt(response.headers["X-RateLimit-Remaining"]), "PX", 900000);

		if(response.headers["X-RateLimit-Reset"]) {
			setTimeout(async () => {
				await redis.incr(`${route}:remaining`);
			}, Date.now() - parseInt(response.headers["X-RateLimit-Reset"]));
		}
	}

	if(response.status === 429) {
		["req", "protocol", "host", "_endCallback", "_callback",
			"_fullfilledPromise", "res", "response", "called"].forEach(key => {
			delete request[key];
		});

		return await module.exports(redis, request);
	} else {
		return response;
	}
};
