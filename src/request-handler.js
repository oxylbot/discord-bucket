const endpoints = require("./endpoints");
const logger = require("./logger");
const ratelimit = require("./ratelimits");

function hasProperty(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

const converter = {
	channel(channel) {
		return {
			id: channel.id,
			type: channel.type,
			guildId: channel.guild_id,
			position: channel.position,
			permissionOverwrites: (channel.permission_overwrites || []).map(overwrite => converter.overwrite(overwrite)),
			name: channel.name,
			topic: channel.topic,
			nsfw: channel.nsfw,
			bitrate: channel.bitrate,
			userLimit: channel.user_limit,
			parentId: channel.parent_id
		};
	},
	overwrite(overwrite) {
		return {
			id: overwrite.id,
			type: overwrite.type,
			allow: overwrite.allow,
			deny: overwrite.deny
		};
	},
	message(message) {
		return {
			id: message.id,
			channelId: message.channel_id,
			guildId: message.guild_id,
			authorId: message.author.id,
			content: message.content,
			attachments: message.attachments.map(attachment => converter.attachment(attachment)),
			pinned: message.pinned,
			reactions: (message.reactions || []).map(reaction => converter.reaction(reaction))
		};
	},
	attachment(attachment) {
		return {
			id: attachment.id,
			filename: attachment.filename,
			size: attachment.size,
			url: attachment.proxy_url,
			height: attachment.height,
			width: attachment.width
		};
	},
	reaction(reaction) {
		return {
			count: reaction.count,
			emojiId: reaction.emoji.id,
			emojiName: reaction.emoji.name
		};
	},
	guild(guild) {
		return {
			id: guild.id,
			name: guild.name,
			icon: guild.icon,
			splash: guild.splash,
			ownerId: guild.owner_id,
			permissions: guild.permission,
			region: guild.region,
			approximatememberCount: guild.approximate_member_count,
			approximatePresenceCount: guild.approximate_presence_count,
			roles: guild.roles.map(role => converter.role(role)),
			members: (guild.members || []).map(member => converter.member(member)),
			channels: (guild.channels || []).map(channel => converter.channel(channel))
		};
	},
	ban(ban) {
		return {
			user: converter.user(ban.user),
			reason: ban.reason
		};
	},
	member(member) {
		return {
			user: converter.user(member.user),
			nick: member.nick,
			roles: member.roles,
			joinedAt: member.joined_at
		};
	},
	user(user) {
		return {
			id: user.id,
			username: user.username,
			discriminator: user.discriminator,
			avatar: user.avatar,
			bot: !!user.bot
		};
	},
	role(role) {
		return {
			id: role.id,
			name: role.name,
			color: role.color,
			hoist: role.hoist,
			position: role.position,
			permissions: role.permissions,
			mentionable: role.mentionable
		};
	}
};

const embedConverter = data => {
	const embed = {};
	if(hasProperty(data, "title")) embed.title = data.title;
	if(hasProperty(data, "description")) embed.description = data.description;
	if(hasProperty(data, "url")) embed.url = data.url;
	if(hasProperty(data, "timestamp")) embed.timestamp = data.timestamp;
	if(hasProperty(data, "color")) embed.color = data.color;
	if(hasProperty(data, "image")) embed.image = { url: data.image.url };
	if(hasProperty(data, "thumbnail")) embed.thumbnail = { url: data.thumbnail.url };

	if(hasProperty(data, "footer")) {
		embed.footer = { text: data.footer.text };
		if(hasProperty(data.footer, "iconUrl")) embed.footer.icon_url = data.footer.iconUrl;
	}

	if(hasProperty(data, "author")) {
		embed.author = {};
		if(hasProperty(data.author, "name")) embed.author.name = data.author.name;
		if(hasProperty(data.author, "url")) embed.author.url = data.author.url;
		if(hasProperty(data.author, "iconUrl")) embed.author.icon_url = data.author.iconUrl;
	}

	if(hasProperty(data, "fields")) {
		embed.fields = data.fields.map(field => ({
			name: field.name,
			value: field.value,
			inline: field.inline
		}));
	}

	return embed;
};

const handle = async (requestType, data) => {
	logger.debug(`Handling a ${requestType} request`);

	switch(requestType) {
		case "GetGateway": {
			const request = endpoints.getGateway();

			const resp = await ratelimit(request);
			return {
				responseType: "discord.gateway.Response",
				data: {
					url: resp.body.url,
					shards: resp.body.shards,
					sessionStartLimit: {
						total: resp.body.session_start_limit.total,
						remaining: resp.body.session_start_limit.remaining,
						resetAfter: resp.body.session_start_limit.reset_after
					},
					maxConcurrency: resp.body.session_start_limit.max_concurrency
				}
			};
		}

		case "GetChannel": {
			const request = endpoints.getChannel(data.channelId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Channel",
				data: converter.channel(resp.body)
			};
		}

		case "EditChannel": {
			const request = endpoints.editChannel(data.channelId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const body = {};
			if(hasProperty(data, "name")) body.name = data.name;
			if(hasProperty(data, "position")) body.position = data.position;
			if(hasProperty(data, "topic")) body.topic = data.topic;
			if(hasProperty(data, "nsfw")) body.nsfw = data.nsfw;
			if(hasProperty(data, "rateLimitPerUser")) body.rate_limit_per_user = data.rateLimitPerUser;
			if(hasProperty(data, "bitrate")) body.bitrate = data.bitrate;
			if(hasProperty(data, "userLimit")) body.user_limit = data.userLimit;
			if(hasProperty(data, "permissionOverwrites")) {
				body.permission_overwrites = data.permissionOverwrites.map(overwrite => ({
					id: overwrite.id,
					type: overwrite.type,
					allow: Number(overwrite.allow),
					deny: Number(overwrite.deny)
				}));
			}
			if(hasProperty(data, "parentId")) body.parent_id = data.parentId;

			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Channel",
				data: converter.channel(resp.body)
			};
		}

		case "DeleteChannel": {
			const request = endpoints.deleteChannel(data.channelId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Channel",
				data: converter.channel(resp.body)
			};
		}

		case "GetChannelMessage": {
			const request = endpoints.getChannelMessage(data.channelId, data.messageId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Message",
				data: converter.message(resp.body)
			};
		}

		case "GetChannelMessages": {
			const request = endpoints.getChannelMessages(data.channelId);

			if(hasProperty(data, "around")) request.query({ around: data.around });
			else if(hasProperty(data, "before")) request.query({ before: data.before });
			else if(hasProperty(data, "after")) request.query({ after: data.after });
			if(hasProperty(data, "limit")) request.query({ limit: data.limit });

			const resp = await ratelimit(request);
			return {
				responseType: "discord.channels.getMessages.Response",
				data: { messages: resp.body.map(message => converter.message(message)) }
			};
		}

		case "CreateChannelMessage": {
			const request = endpoints.createChannelMessage(data.channelId);

			const body = {
				content: data.content,
				tts: false
			};

			if(hasProperty(data, "embed")) body.embed = embedConverter(body.embed);
			if(hasProperty(data, "allowedMentions")) body.allowedMnetions = data.allowedMentions;

			if(hasProperty(data, "file")) {
				request.type("form")
					.attach("file", data.file.file, data.file.name)
					.field("payload_json", JSON.stringify(body));
			} else {
				request.send(body);
			}

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Message",
				data: converter.message(resp.body)
			};
		}

		case "CreateReaction": {
			const request = endpoints.createReaction(data.channelId, data.messageId, data.emoji);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "DeleteReaction": {
			const request = endpoints.deleteReaction(data.channelId, data.messageId, data.emoji, data.userId);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "GetReactions": {
			const request = endpoints.getReactions(data.channelId, data.messageId, data.emoji);

			if(hasProperty(data, "before")) request.query({ before: data.before });
			else if(hasProperty(data, "after")) request.query({ after: data.after });
			if(hasProperty(data, "limit")) request.query({ limit: data.limit });

			const resp = await ratelimit(request);
			return {
				responseType: "discord.channels.getReactions.Request",
				data: { reactions: resp.body.map(reaction => converter.reaction(reaction)) }
			};
		}

		case "DeleteAllReactions": {
			const request = endpoints.deleteAllReactions(data.channelId, data.messageId);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "EditMessage": {
			const request = endpoints.editMessage(data.channelId, data.messageId);

			const body = {};
			if(hasProperty(data, "content")) body.content = data.content;
			if(hasProperty(data, "embed")) body.embed = embedConverter(body.embed);
			if(hasProperty(data, "allowedMentions")) body.allowedMnetions = data.allowedMentions;
			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Message",
				data: converter.message(resp.body)
			};
		}

		case "DeleteMessage": {
			const request = endpoints.deleteMessage(data.channelId, data.messageId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "BulkDeleteMessages": {
			const request = endpoints.bulkDeleteMessages(data.channelId);

			request.send({ messages: data.messages });

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "EditChannelPermission": {
			const request = endpoints.editChannelPermission(data.channelId, data.overwriteId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			request.send({
				allow: Number(data.allow),
				deny: Number(data.deny),
				type: data.type
			});


			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "DeleteChannelPermission": {
			const request = endpoints.deleteChannelPermission(data.channelId, data.overwriteId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "TriggerTypingIndicator": {
			const request = endpoints.triggerTypingIndicator(data.channelId);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "GetGuild": {
			const request = endpoints.getGuild(data.guildId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Guild",
				data: converter.guild(resp.body)
			};
		}

		case "EditGuild": {
			const request = endpoints.editGuild(data.guildId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const body = {};

			if(hasProperty(data, "name")) body.name = data.name;
			if(hasProperty(data, "region")) body.region = data.region;
			if(hasProperty(data, "verificationLevel")) body.verification_level = data.verificationLevel;
			if(hasProperty(data, "explicitContentFilter")) body.explicit_content_filter = data.explicitContentFilter;
			if(hasProperty(data, "afkChannelId")) body.afk_channel_id = data.afkChannelId;
			if(hasProperty(data, "afkTimeout")) body.afk_timeout = data.afkTimeout;
			if(hasProperty(data, "icon")) body.icon = data.icon;
			if(hasProperty(data, "ownerId")) body.owner_id = data.ownerId;
			if(hasProperty(data, "splash")) body.splash = data.splash;
			if(hasProperty(data, "systemChannelId")) body.system_channel_id = data.systemChannelId;
			if(hasProperty(data, "defaultMessageNotifications")) {
				body.default_message_notifications = data.defaultMessageNotifications;
			}

			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Guild",
				data: converter.guild(resp.body)
			};
		}

		case "GetGuildChannels": {
			const request = endpoints.getGuildChannels(data.guildId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.guilds.getChannels.Response",
				data: { channels: resp.body.map(channel => converter.channel(channel)) }
			};
		}

		case "CreateGuildChannel": {
			const request = endpoints.createGuildChannel(data.guildId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const body = { name: data.name };

			if(hasProperty(data, "type")) body.type = data.type;
			if(hasProperty(data, "topic")) body.topic = data.topic;
			if(hasProperty(data, "bitrate")) body.bitrate = data.bitrate;
			if(hasProperty(data, "userLimit")) body.user_limit = data.userLimit;
			if(hasProperty(data, "rateLimitPerUser")) body.rate_limit_per_user = data.rateLimitPerUser;
			if(hasProperty(data, "position")) body.position = data.position;
			if(hasProperty(data, "parentId")) body.parent_id = data.parentId;
			if(hasProperty(data, "nsfw")) body.nsfw = data.nsfw;
			if(hasProperty(data, "permissionOverwrites")) {
				body.permission_overwrites = data.permissionOverwrites.map(overwrite => ({
					id: overwrite.id,
					type: overwrite.type,
					allow: Number(overwrite.allow),
					deny: Number(overwrite.deny)
				}));
			}

			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Channel",
				data: converter.channel(resp.body)
			};
		}

		case "GetGuildMember": {
			const request = endpoints.getGuildMember(data.guildId, data.userId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Member",
				data: converter.member(resp.body)
			};
		}

		case "GetGuildMembers": {
			const request = endpoints.getGuildMembers(data.guildId);

			if(hasProperty(data, "limit")) request.query({ limit: data.limit });
			if(hasProperty(data, "after")) request.query({ after: data.after });

			const resp = await ratelimit(request);
			return {
				responseType: "discord.guilds.getMembers.Response",
				data: { members: resp.body.forEach(member => converter.member(member)) }
			};
		}

		case "EditGuildMember": {
			const request = endpoints.editGuildMember(data.guildId, data.userId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const body = {};

			if(hasProperty(data, "nick")) body.nick = data.nick;
			if(hasProperty(data, "mute")) body.mute = data.mute;
			if(hasProperty(data, "deaf")) body.deaf = data.deaf;
			if(hasProperty(data, "channelId")) body.channel_id = data.channelId;

			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Member",
				data: converter.member(resp.body)
			};
		}

		case "AddGuildMemberRole": {
			const request = endpoints.addGuildMemberRole(data.guildId, data.userId, data.roleId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "RemoveGuildMemberRole": {
			const request = endpoints.removeGuildMemberRole(data.guildId, data.userId, data.roleId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "KickGuildMember": {
			const request = endpoints.kickGuildMember(data.guildId, data.userId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "GetGuildBans": {
			const request = endpoints.getGuildBans(data.guildId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.guilds.getBans.Response",
				data: { bans: resp.body.map(ban => converter.ban(ban)) }
			};
		}

		case "GetGuildBan": {
			const request = endpoints.getGuildBan(data.guildId, data.userId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Ban",
				data: converter.ban(resp.body)
			};
		}

		case "BanGuildMember": {
			const request = endpoints.banGuildMember(data.guildId, data.userId);

			request.set("X-Audit-Log-Reason", data.reason);

			request.send({
				reason: data.reason,
				"delete-message-days": data.deleteMessageDays
			});

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "UnbanGuildMember": {
			const request = endpoints.unbanGuildMember(data.guildId, data.userId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "GetGuildRoles": {
			const request = endpoints.getGuildRoles(data.guildId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.guilds.getRoles.Response",
				data: { roles: resp.body.map(role => converter.role(role)) }
			};
		}

		case "CreateGuildRole": {
			const request = endpoints.createGuildRole(data.guildId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const body = {};

			if(hasProperty(data, "name")) body.name = data.name;
			if(hasProperty(data, "permissions")) body.permissions = Number(data.permissions);
			if(hasProperty(data, "position")) body.position = data.position;
			if(hasProperty(data, "color")) body.color = data.color;
			if(hasProperty(data, "hoist")) body.hoist = data.hoist;
			if(hasProperty(data, "mentionable")) body.mentionable = data.mentionable;

			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Role",
				data: converter.role(resp.body)
			};
		}

		case "EditGuildRole": {
			const request = endpoints.editGuildRole(data.guildId, data.roleId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			const body = {};

			if(hasProperty(data, "name")) body.name = data.name;
			if(hasProperty(data, "permissions")) body.permissions = Number(data.permissions);
			if(hasProperty(data, "position")) body.position = data.position;
			if(hasProperty(data, "color")) body.color = data.color;
			if(hasProperty(data, "hoist")) body.hoist = data.hoist;
			if(hasProperty(data, "mentionable")) body.mentionable = data.mentionable;

			request.send(body);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.Role",
				data: converter.role(resp.body)
			};
		}

		case "DeleteGuildRole": {
			const request = endpoints.deleteGuildRole(data.guildId, data.roleId);

			if(hasProperty(data, "reason")) request.set("X-Audit-Log-Reason", data.reason);

			await ratelimit(request);
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}

		case "GetUser": {
			const request = endpoints.getUser(data.userId);

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.User",
				data: converter.user(resp.body)
			};
		}

		case "CreateDM": {
			const request = endpoints.createDM();

			request.send({ recipient_id: data.recipientId });

			const resp = await ratelimit(request);
			return {
				responseType: "discord.types.User",
				data: converter.user(resp.body)
			};
		}

		default: {
			return {
				responseType: "discord.types.Empty",
				data: {}
			};
		}
	}
};

module.exports = async (requestType, data) => {
	try {
		return await handle(requestType, data);
	} catch(error) {
		if(hasProperty(error, Symbol.for("DiscordError"))) {
			return {
				responseType: "discord.types.HTTPError",
				data: {
					code: error.code,
					status:	error.status,
					message: error.message
				}
			};
		} else {
			throw error;
		}
	}
};
