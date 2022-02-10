import * as Discord from "discord.js";
import { Logger } from "../utils/logger";
import * as Modules from "./modules";

// export type { Modules };
/** @public */
export interface ClinetOptions<T extends Modules.Services.ServiceObject> {
	services: T;
	plugins?: {
		folder?: string;
	};
	logLevels?: Parameters<Dingir.logger.LoggerService['disableLevel']>[0][]
	client: Discord.ClientOptions;
	token: string;
}
/** @public */
export class Client<
	T extends Modules.Services.ServiceObject = Modules.Services.ServiceObject,
> extends Discord.Client {
	store!: Modules.Store.Module;
	services!: Modules.Services.Module<T>;

	private constructor(options: Discord.ClientOptions) {
		super(options);
	}

	static async Invoke<T extends Modules.Services.ServiceObject>(options: ClinetOptions<T>) {
		const client = new Client<T>(options.client);
		
		options.logLevels?.forEach(level => Logger.enableLevel(level));

		client.store = new Modules.Store.Module();
		client.services = await Modules.Services.Module<T>(options.services, client, {
			folder: options?.plugins?.folder || `${process.cwd()}/plugins/**/*.{dg,ts}`,
		});

		await client.login(options.token);
		return client;
	}
}
