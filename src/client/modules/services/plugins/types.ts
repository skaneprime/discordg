import { Awaitable, ClientEvents } from "discord.js";
import { Client } from "../../..";
import { ServiceObject as SO } from "..";
import { Database } from "./database";

/** @public */
export { Database };
/** @public */
export type EventsListeners = {
	[K in keyof ClientEvents as `on${Capitalize<K>}`]?: Dingir.Utils.Function.Any<
		ClientEvents[K], //[...],
		void
	>;
};
/** @public */
export type Config<T> = {
	getPath(): string;
	get(type?: "yml" | "json"): T;
	save(data: T): Promise<void>;
};
/** @public */
export type PluginParameters<T extends SO = SO> = [
	{
		client: Client<T>;
		database: Database<T>;
		onMessage: (callback: (id: string, name: string, ...args: unknown[]) => void) => void;
		getConfig<T>(defaultData: T): Config<T>;
		getConfig<T>(filename: string, defaultData: T): Config<T>;
	},
];

export type Plugin<T extends SO = SO> = Dingir.Utils.Function.Any<
	PluginParameters<T>,
	Awaitable<EventsListeners | void>
>;
