/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Discord from "discord.js";
import * as DiscordBuilders from "@discordjs/builders";
import { ServiceArgs, ServiceObject } from "./client/modules/services";

type InteractionCallback<I, T extends ServiceObject> = Dingir.Utils.Function.Any<
	[I, ...ServiceArgs<T>],
	Discord.Awaitable<void>
>;

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
interface IApplicationCommand<I> {
	guilds?: string[];
	callback?: InteractionCallback<I, any>;

	setGuild(
		guilds: Discord.Guild | Discord.Snowflake | Array<Discord.Guild | Discord.Snowflake>,
	): this;
	setCallback<T extends ServiceObject>(callback: InteractionCallback<I, T>): this;
}
function extendApplicationCommand<I>() {
	return <C extends Dingir.Utils.Class.Any>(
		Class: C,
	): C & Dingir.Utils.Class.Any<any[], IApplicationCommand<I>> =>
		class ApplicationCommand extends Class {
			guilds?: string[];
			callback!: InteractionCallback<I, any>;

			constructor(...args: any[]) {
				super(...args);
			}

			setGuild(
				guilds: Discord.Guild | Discord.Snowflake | Array<Discord.Guild | Discord.Snowflake>,
			): this {
				if (Array.isArray(guilds)) {
					this.guilds = guilds.map((guild) => (guild instanceof Discord.Guild ? guild.id : guild));
				} else this.guilds = guilds instanceof Discord.Guild ? [guilds.id] : [guilds];

				return this;
			}

			setCallback<T extends ServiceObject>(callback: InteractionCallback<I, T>): this {
				this.callback = callback;
				return this;
			}

			setHelp() {
				return;
			}
		};
}
/** @public */
export interface MessageComponentPath {
	channelId: Discord.Snowflake;
	messageId: Discord.Snowflake;
}
/** @public */
interface IMessageComponent<I> {
	callback: InteractionCallback<I, any>;
	setCallback<T extends ServiceObject>(callback: InteractionCallback<I, T>): this;
}
function extendMessageComponent<I>() {
	return <C extends Dingir.Utils.Class.Any>(
		Class: C,
	): C & Dingir.Utils.Class.Any<any[], IMessageComponent<I>> =>
		class MessageComponent extends Class {
			callback!: InteractionCallback<I, any>;

			setCallback<T extends ServiceObject>(callback: InteractionCallback<I, T>): this {
				this.callback = callback;
				return this;
			}
		};
}
/** @public */
export class SlashCommand extends extendApplicationCommand<Discord.CommandInteraction>()(
	DiscordBuilders.SlashCommandBuilder,
) {}
/** @public */
export class ContextMenuCommand extends extendApplicationCommand<Discord.ContextMenuInteraction>()(
	DiscordBuilders.ContextMenuCommandBuilder,
) {
	public static User = modifyClass(ContextMenuCommand, "setType", [2]);
	public static Message = modifyClass(ContextMenuCommand, "setType", [3]);
}
/** @public */
export class ButtonComponent extends extendMessageComponent<Discord.ButtonInteraction>()(
	Discord.MessageButton,
) {}
/** @public */
export class SelectMenuComponent extends extendMessageComponent<Discord.SelectMenuInteraction>()(
	Discord.MessageSelectMenu,
) {}
/** @public */
export class MessageActionRow extends Discord.MessageActionRow {
	public components: (ButtonComponent | SelectMenuComponent)[] = [];
}
/** @public */
export class MessageActionRows {
	public path!: MessageComponentPath;
	public rows: MessageActionRow[] = [];

	constructor(rows?: MessageActionRow[]) {
		this.rows = rows || [];
	}

	setPath(path: MessageComponentPath) {
		this.path = path;
		this.path.toString = () => {
			return `${path.channelId}/${path.messageId}`;
		};
		return this;
	}

	addRows(...rows: MessageActionRow[]) {
		this.rows.push(...rows);
		return this;
	}

	static getPath(path: Discord.MessageComponentInteraction) {
		return `${path.channelId}/${path.message.id}`;
	}
}
