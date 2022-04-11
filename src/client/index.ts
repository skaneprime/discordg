import "reflect-metadata";
import * as Discord from "discord.js";
import * as Modules from "./modules";
import logger from "../utils/logger";
import { Plugin } from "../plugins";

// export type { Modules };
/** @public */
export interface ClinetOptions<T extends Modules.Services.ServiceObject> {
	services?: T;
	plugins?: {
		folder?: string;
		plugins?: Plugin<T>[];
	};
	logLevels?: Parameters<Dingir.Logger.LoggerService["disableLevel"]>[0][];
	client: Discord.ClientOptions;
	token: string;
}
/** @public */
export class Client<
	T extends Modules.Services.ServiceObject = Modules.Services.ServiceObject,
	Ready extends boolean = false,
> extends Discord.Client<Ready> {
	services!: Modules.Services.Module<T>;

	private constructor(options: Discord.ClientOptions) {
		super(options);
	}

	public isReady(): this is Client<T, true> {
		return this.ws.status === Discord.Status.Ready;
	}

	static async Invoke<T extends Modules.Services.ServiceObject>(options: ClinetOptions<T>) {
		const client = new Client<T>(options.client);

		options.logLevels?.forEach((level) => logger.enableLevel(level));

		client.services = await Modules.Services.Module<T>(options.services || ({} as T), client, {
			folder: options?.plugins?.folder || `${process.cwd()}/plugins/**/*.{dg,ts}`,
			plugins: options.plugins?.plugins || [],
		});

		await client.login(options.token);

		return client as unknown as Client<T, true>;
	}
}
