const { version } = require("../package");
const ratelimit = require("./ratelimits");
const superagent = require("superagent");

const BASE_URL = "https://discordapp.com/api";
const VERSION = 6;

class Term {
	constructor(request, methods = []) {
		this.request = request;

		methods.forEach(method => {
			if(typeof method === "object") {
				this[method.use] = (...args) => {
					request.complete = false;
					return request[method.real](...args);
				};
			} else {
				this[method] = (...args) => {
					request.complete = false;
					return request[method](...args);
				};
			}
		});
	}

	run() {
		return this.request.run();
	}

	then(...args) {
		this.request.then(...args);
	}
}

class Request {
	constructor(redis, token) {
		this.redis = redis;
		this.url = `${BASE_URL}/v${VERSION}`;
		this.request = superagent;
		this.multipart = false;
		this.method = "get";
		this.body = {};
		this.query = {};
		this.headers = {
			Authorization: `Bot ${token}`,
			"User-Agent": `DiscordBot (https://github.com/oxylbot, ${version})`
		};

		this.complete = false;
		return new Term(this, ["gateway"]);
	}

	addPath(...paths) {
		this.url += `/${paths.join("/")}`;
	}

	setMethod(method) {
		this.method = method;
	}

	delete() {
		this.setMethod("delete");
		this.complete = true;

		return new Term(this, ["reason"]);
	}

	gateway() {
		this.addPath("gateway");
		this.complete = true;

		return new Term(this, [{
			use: "bot",
			real: "gatewayBot"
		}]);
	}

	gatewayBot() {
		this.addPath("bot");
		this.complete = true;

		return new Term(this);
	}

	reason(reason) {
		if(!reason) throw new Error("Reason not given");

		this.headers["X-Audit-Log-Reason"] = reason;
		this.complete = true;

		return new Term(this);
	}

	channels() {
		this.addPath("channels");

		return new Term(this, [{
			use: "get",
			real: "getChannel"
		}]);
	}

	getChannel(id) {
		if(!id) throw new Error("ID must be defined for channels().get(id)");

		this.addPath(id);
		this.complete = true;

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}, {
			use: "messages",
			real: "getChannelMessages"
		}, {
			use: "send",
			real: "createChannelMessage"
		}, {
			use: "type",
			real: "triggerTyping"
		}, "overwrites", "invites", "pins", "delete"]);
	}

	pins() {
		this.addPath("pins");
		this.complete = true;

		return new Term(this, [{
			use: "get",
			real: "getPinnedMessage"
		}, {
			use: "add",
			real: "addPinnedMessage"
		}]);
	}

	addPinnedMessage(id) {
		if(!id) throw new Error("Message ID must be defined for channels().get(id).pins().add(id)");

		this.addPath(id);
		this.setMethod("put");
		this.complete = true;

		return new Term(this);
	}

	getPinnedMessage(id) {
		if(!id) throw new Error("Message ID must be defined for channels().get(id).pins().get(id)");

		this.addPath(id);

		return new Term(this, ["delete"]);
	}

	triggerTyping() {
		this.addPath("typing");
		this.setMethod("post");
		this.complete = true;

		return new Term(this);
	}

	invites() {
		this.addPath("invites");
		this.complete = true;

		return new Term(this, [{
			use: "create",
			real: "createInvite"
		}]);
	}

	createInvite({ age, uses, temporary, unique } = {}) {
		this.setMethod("post");
		this.complete = true;

		if(typeof age !== "undefined") this.body.max_age = age;
		if(typeof uses !== "undefined") this.body.max_uses = uses;
		if(typeof temporary !== "undefined") this.body.temporary = !!temporary;
		if(typeof unique !== "undefined") this.body.unique = !!unique;

		return new Term(this);
	}

	overwrites() {
		this.addPath("permissions");

		return new Term(this, [{
			use: "get",
			real: "getOverwrite"
		}]);
	}

	getOverwrite(id) {
		if(!id) throw new Error("Message ID must be defined for channels().get(id).overwrites().get(id)");

		this.addPath(id);

		return new Term(this, [{
			use: "edit",
			real: "editOverwrite"
		}, "delete"]);
	}

	editOverwrite({ allow, deny, type } = {}) {
		if(typeof allow === "undefined") {
			throw new Error("Allow must be defined for " +
				"channels().get(id).overwrites().get(id).edit({ allow, deny, type })");
		} else if(typeof deny === "undefined") {
			throw new Error("Deny must be defined for " +
				"channels().get(id).overwrites().get(id).edit({ allow, deny, type })");
		} else if(typeof type === "undefined") {
			throw new Error("Type must be defined for " +
				"channels().get(id).overwrites().get(id).edit({ allow, deny, type })");
		} else if(!Number.isInteger(allow)) {
			throw new Error("Allow must be an integer for " +
				"channels().get(id).overwrites().get(id).edit({ allow, deny, type })");
		} else if(!Number.isInteger(deny)) {
			throw new Error("Deny must be an integer for " +
				"channels().get(id).overwrites().get(id).edit({ allow, deny, type })");
		} else if(!["role", "member"].includes(type)) {
			throw new Error("Type must be either \"member\" or \"role\" for " +
				"channels().get(id).overwrites().get(id).edit({ allow, deny, type })");
		}

		this.complete = true;
		this.setMethod("put");
		this.body = { allow,
			deny,
			type };

		return new Term(this);
	}

	createChannelMessage(content) {
		if(typeof content === "undefined") {
			this.body.content = content;
		} else if(typeof content === "object") {
			if(typeof content.content !== "undefined") this.body.content = content.content.toString();
			else this.body.content = "";

			if(content.file) this.body.file = content.file;
			else if(content.hasOwnProperty("file")) this.body.file = content;

			if(content.embed) this.body.embed = content;
			else if(["title", "description", "fields", "image", "footer", "thumbnail", "author"]
				.some(field => content.hasOwnProperty(field))) this.body.embed = content;
		}


		if(content.file) this.multipart = true;
		this.complete = true;
		this.setMethod("post");
		this.addPath("messages");

		return new Term(this);
	}

	getChannelMessages({ around, before, after, limit } = {}) {
		if(typeof around !== "undefined") this.query.around = around;
		else if(typeof before !== "undefined") this.query.before = before;
		else if(typeof after !== "undefined") this.query.after = after;
		if(typeof limit !== "undefined") this.query.limit = limit;

		this.addPath("messages");
		this.complete = true;

		return new Term(this, [{
			use: "get",
			real: "getChannelMessage"
		}, "bulkDelete"]);
	}

	bulkDelete(messages) {
		if(!Array.isArray(messages)) {
			throw new Error("Messages must be an array in channels().get(id).messages().bulkDelete(messages)");
		} else if(messages.length < 2) {
			throw new Error("More than 2 message ids must be sent for channels().get(id).messages().bulkDelete(messages)");
		} else if(messages.length > 100) {
			throw new Error("Less than 100 message ids must be sent for channels().get(id).messages().bulkDelete(messages)");
		}

		this.setMethod("post");
		this.complete = true;

		return new Term(this);
	}

	getChannelMessage(id) {
		if(!id) throw new Error("Message ID must be defined for channels().get(id).messages().get(id)");

		this.addPath(id);
		this.complete = true;

		return new Term(this, [{
			use: "reactions",
			real: "getMessageReactions"
		}, {
			use: "edit",
			real: "editMessage"
		}, "delete"]);
	}

	editMessage(content) {
		if(typeof content === "undefined") {
			this.body.content = content;
		} else if(typeof content === "object") {
			if(typeof content.content !== "undefined") this.body.content = content.content.toString();
			else this.body.content = "";

			if(content.embed) this.body.embed = content;
			else if(["title", "description", "fields", "image", "footer", "thumbnail", "author"]
				.some(field => content.hasOwnProperty(field))) this.body.embed = content;
		}

		this.setMethod("patch");
		this.complete = true;

		return new Term(this);
	}

	getMessageReactions(emoji, { before, after, limit } = {}) {
		if(emoji) throw new Error("Emoji must be defined for channels().get(id).messages().get(id).reactions(emoji)");

		if(typeof before !== "undefined") this.query.before = before;
		else if(typeof after !== "undefined") this.query.after = after;
		if(typeof limit !== "undefined") this.query.limit = limit;

		this.addPath("reactions", emoji);
		this.complete = true;

		return new Term(this, [{
			use: "react",
			real: "addMessageReaction"
		}, {
			use: "user",
			real: "setReactor"
		}, "delete"]);
	}

	addMessageReaction() {
		this.setMethod("put");

		this.addPath("@me");
		this.complete = true;

		return new Term(this);
	}

	setReactor(id) {
		if(!id) {
			throw new Error("User ID must be defined for " +
				"channels().get(id).messages().get(id).reactions(emoji).user(id)");
		}

		this.addPath(id);
		return new Term(this, ["delete"]);
	}

	setChannelName(name) {
		if(!name) {
			throw new Error("Name but be defined for channels.get(id).name(name)");
		} else if(name.length < 2 || name.length > 100) {
			throw new Error("Name must be between 2 and 100 characters for channels.get(id).name(name)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.name = name.toString();

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	setChannelPosition(position) {
		if(!Number.isInteger(position) || position < 0) {
			throw new Error("Position but be a finite integer greater than 0 for channels.get(id).position(position)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.position = position;

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	setChannelTopic(topic) {
		if(!topic) {
			topic = "";
		} else if(topic.length > 1024) {
			throw new Error("Topic must be no more than 1024 characters for channels.get(id).topic(topic)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.name = topic.toString();

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	setChannelNSFW(nsfw) {
		if(typeof nsfw !== "boolean") {
			throw new Error("channels.get(id).nsfw(boolean) requires a boolean value");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.nsfw = nsfw;

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	setChannelRatelimit(ratelimitPerUser) {
		if(!Number.isInteger(ratelimitPerUser)) {
			throw new Error("Ratelimit but be a finite integer for channels.get(id).ratelimit(ratelimit)");
		} else if(ratelimitPerUser < 0 || ratelimitPerUser > 120) {
			throw new Error("Ratelimit but be between 0 and 120 for channels.get(id).ratelimit(ratelimit)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.rate_limit_per_user = ratelimitPerUser;

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	setChannelBitrate(bitrate) {
		if(!Number.isInteger(bitrate)) {
			throw new Error("Bitrate but be a finite integer for channels.get(id).bitrate(bitrate)");
		} else if(bitrate < 8000 || bitrate > 128000) {
			throw new Error("Bitrate but be between 8000 and 128000 (96000 for non-vip)" +
				" for channels.get(id).bitrate(bitrate)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.bitrate = bitrate;

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	setChannelUserLimit(limit) {
		if(!Number.isInteger(limit)) {
			throw new Error("Limit but be a finite integer for channels.get(id).userLimit(limit)");
		} else if(limit < 0 || limit > 100) {
			throw new Error("Limit but be between 0 and 100 for channels.get(id).userLimit(limit)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.user_limit = limit;

		return new Term(this, [{
			use: "name",
			real: "setChannelName"
		}, {
			use: "position",
			real: "setChannelPosition"
		}, {
			use: "topic",
			real: "setChannelTopic"
		}, {
			use: "nsfw",
			real: "setChannelNSFW"
		}, {
			use: "ratelimit",
			real: "setChannelRatelimit"
		}, {
			use: "bitrate",
			real: "setChannelBitrate"
		}, {
			use: "userLimit",
			real: "setChannelUserLimit"
		}, {
			use: "parentID",
			real: "setChannelParentID"
		}]);
	}

	guilds() {
		this.addPath("guilds");
		this.complete = true;

		return new Term(this, [{
			use: "create",
			real: "createGuild"
		}, {
			use: "get",
			real: "getGuild"
		}]);
	}

	createGuild(id) {
		if(!id) return new Error("ID must be defined for guilds().create(id)");

		this.setMethod("post");
		this.complete = true;

		return new Term(this);
	}


	getGuild(id) {
		if(!id) throw new Error("ID must be defined for guilds().get(id)");

		this.addPath(id);
		this.complete = true;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}, {
			use: "channels",
			real: "getGuildChannels"
		}, {
			use: "members",
			real: "getGuildMembers"
		}, "auditLogs", "emojis", "delete"]);
	}

	setGuildName(name) {
		if(!name) {
			throw new Error("Name but be defined for channels.get(id).name(name)");
		} else if(name.length < 2 || name.length > 100) {
			throw new Error("Name must be between 2 and 100 characters for channels.get(id).name(name)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.name = name.toString();

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildRegion(region) {
		if(typeof region === "undefined") {
			throw new Error("Region must be defined for guilds().get(id).region(region)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.region = region;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildVerificationLevel(level) {
		if(typeof level === "undefined") {
			throw new Error("Verification level must be defined for guilds().get(id).verificationLevel(level)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.verfication_level = level;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildDefaultMessageNotificationLevel(level) {
		if(typeof level === "undefined") {
			throw new Error("Notification level must be defined for " +
				"guilds().get(id).defaultMessageNotificationLevel(level)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.default_message_notifications = level;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildExplicitContentFilterLevel(level) {
		if(typeof level === "undefined") {
			throw new Error("Explicit content filter level must be defined for " +
				"guilds().get(id).explicitContentFilterLevel(level)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.explicit_content_filter = level;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildAfkChannelID(id) {
		if(typeof id === "undefined") {
			throw new Error("AFK Channel ID must be defined for guilds().get(id).afkChannelID(id)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.afk_channel_id = id;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildAfkTimeout(timeout) {
		if(typeof timeout === "undefined") {
			throw new Error("AFK Timeout must be defined for guilds().get(id).afkTimeout(timeout)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.afk_timeout = timeout;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildIcon(icon) {
		if(typeof icon === "undefined") {
			throw new Error("Icon must be defined for guilds().get(id).icon(icon)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.icon = icon;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildOwnerID(id) {
		if(typeof id === "undefined") {
			throw new Error("Owner ID must be defined for guilds().get(id).ownerID(id)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.owner_id = id;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildSplash(splash) {
		if(typeof splash === "undefined") {
			throw new Error("Splash must be defined for guilds().get(id).splash(splash)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.splash = splash;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	setGuildSystemChannelID(id) {
		if(typeof id === "undefined") {
			throw new Error("System channel ID must be defined for guilds().get(id).systemChannel(id)");
		}

		this.setMethod("patch");
		this.complete = true;
		this.body.system_channel_id = id;

		return new Term(this, [{
			use: "name",
			real: "setGuildName"
		}, {
			use: "region",
			real: "setGuildRegion"
		}, {
			use: "verificationLevel",
			real: "setGuildVerificationLevel"
		}, {
			use: "defaultMessageNotificationLevel",
			real: "setGuildDefaultMessageNotificationLevel"
		}, {
			use: "explicitContentFilterLevel",
			real: "setGuildExplicitContentFilterLevel"
		}, {
			use: "afkChannel",
			real: "setGuildAfkChannelID"
		}, {
			use: "afkTimeout",
			real: "setGuildAfkTimeout"
		}, {
			use: "icon",
			real: "setGuildIcon"
		}, {
			use: "owner",
			real: "setGuildOwnerID"
		}, {
			use: "splash",
			real: "setGuildSplash"
		}, {
			use: "systemChannel",
			real: "setGuildSystemChannelID"
		}]);
	}

	getGuildChannels() {
		this.addPath("channels");
		this.complete = true;

		return new Term(this, [{
			use: "create",
			real: "createChannel"
		}]);
	}

	getGuildMembers({ limit, after } = {}) {
		if(typeof limit !== "undefined") this.query.limit = limit;
		if(typeof after !== "undefined") this.query.after = after;

		this.addPath("members");
		this.complete = true;

		return new Term(this, [{
			use: "get",
			real: "getGuildMember"
		}]);
	}

	getGuildMember(id) {
		if(!id) throw new Error("Member ID must be defined for guilds().get(id).members().get(id)");

		this.addPath(id);
		this.complete = true;

		return new Term(this, [{
			use: "nick",
			real: "setMemberNickname"
		}, {
			use: "roles",
			real: "guildMemberRoles"
		}, {
			use: "mute",
			real: "setMemberMute"
		}, {
			use: "deaf",
			real: "setMemberDeaf"
		}, {
			use: "move",
			real: "setMemberChannel"
		}]);
	}

	setMemberNickname(nick) {
		if(typeof nick === "undefined") {
			throw new Error("Nick must be a string or null for guilds().get(id).members().get(id).nick(nick)");
		} else if(nick.length >= 32) {
			throw new Error("Nick must be few than 32 characters for guilds().get(id).members().get(id).nick(nick)");
		}

		this.setMethod("patch");
		this.body.nick = nick;
		this.complete = true;

		return new Term(this);
	}

	guildMemberRoles(roles) {
		if(!Array.isArray(roles)) {
			throw new Error("Roles must be an array in guilds().get(id).members().get(id).roles(roles)");
		}

		this.setMethod("patch");
		this.body.roles = roles;
		this.complete = true;

		return new Term(this);
	}

	setMemberMute(mute) {
		if(typeof mute !== "boolean") {
			throw new Error("Mute must be a boolean in guilds().get(id).members().get(id).mute(mute)");
		}

		this.setMethod("patch");
		this.body.mute = mute;
		this.complete = true;

		return new Term(this);
	}

	setMemberDeaf(deaf) {
		if(typeof deaf !== "boolean") {
			throw new Error("Deaf must be a boolean in guilds().get(id).members().get(id).deaf(deaf)");
		}

		this.setMethod("patch");
		this.body.deaf = deaf;
		this.complete = true;

		return new Term(this);
	}

	setMemberChannel(channel) {
		if(typeof channel !== "string") {
			throw new Error("Channel ID must be a string in guilds().get(id).members().get(id).move(channelID)");
		}

		this.setMethod("patch");
		this.body.channel_id = channel;
		this.complete = true;

		return new Term(this);
	}

	createChannel({ name, type, topic, bitrate, userLimit, rateLimitPerUser, overwrites, parentID, nsfw } = {}) {
		if(typeof name === "undefined") {
			throw new Error("Name must be defined for guilds().get(id).channels().create({ name, ... })");
		}

		this.body.name = name;
		if(typeof type !== "undefined") this.body.type = type;
		if(typeof topic !== "undefined") this.body.topic = topic;
		if(typeof bitrate !== "undefined") this.body.bitrate = bitrate;
		if(typeof userLimit !== "undefined") this.body.user_limit = userLimit;
		if(typeof rateLimitPerUser !== "undefined") this.body.rate_limit_per_user = rateLimitPerUser;
		if(typeof overwrites !== "undefined") this.body.permission_overwrites = overwrites;
		if(typeof parentID !== "undefined") this.body.parent_id = parentID;
		if(typeof nsfw !== "undefined") this.body.nsfw = nsfw;

		this.setMethod("post");
		this.complete = true;

		return new Term(this);
	}

	emojis() {
		this.addPath("emojis");
		this.complete = true;

		return new Term(this, [{
			use: "get",
			real: "getEmoji"
		}, {
			use: "create",
			real: "createEmoji"
		}]);
	}

	getEmoji(id) {
		if(!id) throw new Error("Emoji ID must be defined for guilds().get(id).emojis().get(id)");

		this.addPath(id);
		this.complete = true;

		return new Term(this, [{
			use: "edit",
			real: "editEmoji"
		}, "delete"]);
	}

	createEmoji({ name, image }) {
		if(typeof name === "undefined") {
			throw new Error("Name must be defined for guilds().get(id).emojis().create({ name, image })");
		} else if(typeof image === "undefined") {
			throw new Error("Image must be defined for guilds().get(id).emojis().create({ name, image })");
		}

		this.body = { name,
			image,
			roles: [] };
		this.setMethod("post");
		this.complete = true;

		return new Term(this);
	}

	editEmoji({ name }) {
		if(typeof name === "undefined") {
			throw new Error("Name must be defined for guilds().get(id).emojis().edit({ name })");
		}

		this.body = { name };
		this.setMethod("patch");
		this.complete = true;

		return new Term(this);
	}

	auditLogs({ userID, action, before, limit } = {}) {
		if(typeof userID !== "undefined") this.query.user_id = userID;
		if(typeof action !== "undefined") this.query.action_type = action;
		if(typeof before !== "undefined") this.query.before = before;
		if(typeof limit !== "undefined") this.query.limit = limit;

		this.addPath("audit-logs");
		this.complete = true;

		return new Term(this);
	}

	run() {
		return new Promise((resolve, reject) => this.then(resolve, reject));
	}

	async then(success, failure) {
		if(!this.complete) throw new Error("Cannot execute request if it is not valid");

		const request = this.request[this.method](this.url)
			.set(this.headers)
			.query(this.query);

		if(this.multipart) {
			Object.entries(this.body).forEach(([key, value]) => {
				if(key === "file") request.attach(key, value);
				else request.field(key, value);
			});
		} else {
			request.send(this.body);
		}

		return await ratelimit(this.redis, request);
	}
}

module.exports = (redis, token) => () => new Request(redis, token);
