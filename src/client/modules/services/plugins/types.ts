import { Awaitable, ClientEvents } from "discord.js";
import { Client } from "../../..";
import { ServiceObject as SO } from "..";

export type EventsListeners = {
	[K in keyof ClientEvents as `on${Capitalize<K>}`]?: Dingir.utils.function.Any<
		ClientEvents[K], //[...],
		void
	>;
};

export type PluginParameters<T extends SO> = [
	{
		client: Client<T>;
		onMessage: (callback: (...args: unknown[]) => void) => void;
	},
];

export type Plugin<T extends SO = SO> = Dingir.utils.function.Any<
	PluginParameters<T>,
	Awaitable<EventsListeners>
>;

/**
 * Database ->
 */
