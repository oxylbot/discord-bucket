/* eslint-disable max-len */
const BASE_URL = "https://discordapp.com/api/v6";
const CDN_BASE_URL = "https://cdn.discordapp.com";
const superagent = require("superagent");

module.exports = {
	getGateway: () => superagent.get(`${BASE_URL}/gateway/bot`),
	getChannel: channelID => superagent.get(`${BASE_URL}/channels/${channelID}`),
	editChannel: channelID => superagent.patch(`${BASE_URL}/channels/${channelID}`),
	deleteChannel: channelID => superagent.delete(`${BASE_URL}/channels/${channelID}`),
	getChannelMessages: channelID => superagent.get(`${BASE_URL}/channels/${channelID}/messages`),
	getChannelMessage: (channelID, messageID) => superagent.get(`${BASE_URL}/channels/${channelID}/messages/${messageID}`),
	createChannelMessage: channelID => superagent.post(`${BASE_URL}/channels/${channelID}/messages`),
	createReaction: (channelID, messageID, emoji) => superagent.put(`${BASE_URL}/channels/${channelID}/messages/${messageID}/reactions/${emoji}/@me`),
	deleteReaction: (channelID, messageID, emoji, userID) => superagent.delete(`${BASE_URL}/channels/${channelID}/messages/${messageID}/reactions/${emoji}/${userID}`),
	getReactions: (channelID, messageID, emoji) => superagent.get(`${BASE_URL}/channels/${channelID}/messages/${messageID}/reactions/${emoji}`),
	deleteAllReactions: (channelID, messageID) => superagent.delete(`${BASE_URL}/channels/${channelID}/messages/${messageID}/reactions`),
	editMessage: (channelID, messageID) => superagent.patch(`${BASE_URL}/channels/${channelID}/messages/${messageID}`),
	deleteMessage: (channelID, messageID) => superagent.delete(`${BASE_URL}/channels/${channelID}/messages/${messageID}`),
	bulkDeleteMessages: channelID => superagent.post(`${BASE_URL}/channels/${channelID}/messages/bulk-delete`),
	editChannelPermission: (channelID, overwriteID) => superagent.put(`${BASE_URL}/channels/${channelID}/permissions/${overwriteID}`),
	deleteChannelPermission: (channelID, overwriteID) => superagent.delete(`${BASE_URL}/channels/${channelID}/permissions/${overwriteID}`),
	triggerTypingIndicator: channelID => superagent.post(`${BASE_URL}/channels/${channelID}/typing`),
	getGuild: guildID => superagent.get(`${BASE_URL}/guilds/${guildID}`),
	editGuild: guildID => superagent.patch(`${BASE_URL}/guilds/${guildID}`),
	getGuildChannels: guildID => superagent.get(`${BASE_URL}/guilds/${guildID}/channels`),
	createGuildChannel: guildID => superagent.post(`${BASE_URL}/guilds/${guildID}/channels`),
	getGuildMember: (guildID, memberID) => superagent.get(`${BASE_URL}/guilds/${guildID}/members/${memberID}`),
	getGuildMembers: guildID => superagent.get(`${BASE_URL}/guilds/${guildID}/members`),
	editGuildMember: (guildID, memberID) => superagent.patch(`${BASE_URL}/guilds/${guildID}/members/${memberID}`),
	addGuildMemberRole: (guildID, memberID, roleID) => superagent.put(`${BASE_URL}/guilds/${guildID}/members/${memberID}/roles/${roleID}`),
	removeGuildMemberRole: (guildID, memberID, roleID) => superagent.delete(`${BASE_URL}/guilds/${guildID}/members/${memberID}/roles/${roleID}`),
	kickGuildMember: (guildID, memberID) => superagent.delete(`${BASE_URL}/guilds/${guildID}/members/${memberID}`),
	getGuildBans: guildID => superagent.get(`${BASE_URL}/guilds/${guildID}/bans`),
	getGuildBan: (guildID, userID) => superagent.get(`${BASE_URL}/guilds/${guildID}/bans/${userID}`),
	banGuildMember: (guildID, userID) => superagent.put(`${BASE_URL}/guilds/${guildID}/bans/${userID}`),
	unbanGuildMember: (guildID, userID) => superagent.delete(`${BASE_URL}/guilds/${guildID}/bans/${userID}`),
	getGuildRoles: guildID => superagent.get(`${BASE_URL}/guilds/${guildID}/roles`),
	createGuildRole: guildID => superagent.post(`${BASE_URL}/guilds/${guildID}/roles`),
	editGuildRole: (guildID, roleID) => superagent.patch(`${BASE_URL}/guilds/${guildID}/roles/${roleID}`),
	deleteGuildRole: (guildID, roleID) => superagent.delete(`${BASE_URL}/guilds/${guildID}/roles/${roleID}`),
	getUser: userID => superagent.get(`${BASE_URL}/users/${userID}`),
	createDM: () => superagent.post(`${BASE_URL}/users/@me/channels`),
	cdn: {
		emoji: (emojiID, ext) => `${CDN_BASE_URL}/emojis/${emojiID}.${ext}`,
		guildIcon: (guildID, guildIcon, ext) => `${CDN_BASE_URL}/icons/${guildID}/${guildIcon}.${ext}`,
		guildSplash: (guildID, guildSplash, ext) => `${CDN_BASE_URL}/splashes/${guildID}/${guildSplash}.${ext}`,
		defaultAvatar: discriminator => `${CDN_BASE_URL}/embed/avatars/${discriminator % 5}.png`,
		userAvatar: (userID, userAvatar, ext) => `${CDN_BASE_URL}/avatars/${userID}/${userAvatar}.${ext}`
	}
};
