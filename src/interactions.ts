/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Discord from "discord.js";
import * as DiscordBuilders from "@discordjs/builders";
import { ServiceArgs, ServiceObject } from "./client/modules/services";

type InteractionCallback<I, T extends ServiceObject> = Dingir.Utils.Function.Any<
	[I, ...ServiceArgs<T>],
	Discord.Awaitable<unknown>
>;

/** @public */
export interface MessageComponentPath {
	channelId: Discord.Snowflake;
	messageId: Discord.Snowflake;
}

/** @public */
export class SlashCommand extends guildMixin(
	callbackMixin<Discord.ChatInputCommandInteraction>()(DiscordBuilders.SlashCommandBuilder),
) {}
/** @public */
export class ContextMenuCommand extends guildMixin(
	callbackMixin<Discord.ContextMenuCommandInteraction>()(DiscordBuilders.ContextMenuCommandBuilder),
) {
	public static User = modifyClass(ContextMenuCommand, "setType", [2]);
	public static Message = modifyClass(ContextMenuCommand, "setType", [3]);
}
/** @public */
export class ButtonComponent extends callbackMixin<Discord.ButtonInteraction>()(Discord.ButtonBuilder) {}
/** @public */
export class SelectMenuComponent extends callbackMixin<Discord.SelectMenuInteraction>()(Discord.SelectMenuBuilder) {}
/** @public */
export class ModalBuilder extends callbackMixin<Discord.ModalSubmitInteraction>()(Discord.ModalBuilder) {}
/** @public */
export class ActionRows {
	public path!: MessageComponentPath;
	public rows: Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[] = [];

	constructor(rows?: Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]) {
		this.rows = rows || [];
	}

	setPath(path: MessageComponentPath) {
		this.path = path;
		this.path.toString = () => {
			return `${path.channelId}/${path.messageId}`;
		};
		return this;
	}

	addRows(...rows: Discord.ActionRowBuilder<Discord.MessageActionRowComponentBuilder>[]) {
		this.rows.push(...rows);
		return this;
	}

	static getPath(path: Discord.MessageComponentInteraction) {
		return `${path.channelId}/${path.message.id}`;
	}
}

interface CallbackMixin<I> {
	callback: InteractionCallback<I, any>;
	setCallback<T extends ServiceObject>(callback: InteractionCallback<I, T>): this;
}
function callbackMixin<I>() {
	return <C extends Dingir.Utils.Class.Any>(Class: C): C & Dingir.Utils.Class.Any<any[], CallbackMixin<I>> => {
		const name = `${Class.name} CallbackMixin`;
		return {
			[name]: class extends Class {
				callback!: InteractionCallback<I, any>;

				setCallback<T extends ServiceObject>(callback: InteractionCallback<I, T>): this {
					this.callback = callback;
					return this;
				}
			},
		}[name];
	};
}

interface GuildMixin {
	guilds?: string[];
	setGuild(guilds: Discord.Guild | Discord.Snowflake | Array<Discord.Guild | Discord.Snowflake>): this;
}
function guildMixin<C extends Dingir.Utils.Class.Any>(Class: C): C & Dingir.Utils.Class.Any<any[], GuildMixin> {
	const name = `${Class.name} GuildMixin`;
	return {
		[name]: class extends Class {
			guilds?: string[];

			setGuild(guilds: Discord.Guild | Discord.Snowflake | Array<Discord.Guild | Discord.Snowflake>): this {
				if (Array.isArray(guilds)) {
					this.guilds = guilds.map((guild) => (guild instanceof Discord.Guild ? guild.id : guild));
				} else this.guilds = guilds instanceof Discord.Guild ? [guilds.id] : [guilds];

				return this;
			}
		},
	}[name];
}

function modifyClass<T extends new (...args: any[]) => any, K extends keyof InstanceType<T>>(
	Class: T,
	prop: K,
	args: Parameters<InstanceType<T>[K]>,
): T {
	return {
		[`${Class.name}Modified`]: class extends Class {
			constructor(..._args: any[]) {
				super(_args);
				(this as any)[prop](...args);
			}
		},
	}[`${Class.name}Modified`];
}
