import { Awaitable } from "discord.js";
import { Client } from "../..";

import { Plugin, Plugins } from "./plugins";
import { Interactions } from "./interactions";

/** @public */
export type ServiceArgs<T extends ServiceObject = ServiceObject> = [Client<T, false>];
/** @public */
export type ClassService = Dingir.Utils.Class.Any<ServiceArgs> & {
	Invoke?: (...args: ServiceArgs) => Awaitable<unknown>;
};
/** @public */
export type FunctionService = Dingir.Utils.Function.Any<ServiceArgs>;
/** @public */
export type Service = FunctionService | ClassService;
/** @public */
export type ServiceResult<T extends Service> = Dingir.Utils.Promise.Result<Dingir.Utils.Types.ReturnOrInstance<T>>;
/** @public */
export type ServiceObject = { [key: string]: Service };
/** @public */
export type Module<T extends ServiceObject> = {
	plugins: Plugins<T>;
	interactions: Interactions<T>;
} & {
	[K in keyof T]: ServiceResult<T[K]>;
};
/** @public */
export async function Module<T extends ServiceObject>(
	services: T,
	client: Client<T, false>,
	plugins: {
		folder: string;
		plugins: Plugin<T>[];
	},
) {
	const servicesInvoked = {} as { [K in keyof T]: ServiceResult<T[K]> };

	for (const key in services) {
		const service = services[key];

		if (Dingir.Utils.Class.isClass(service)) {
			const ClassService = service as ClassService;
			servicesInvoked[key] = ((await ClassService.Invoke?.call({}, client)) ||
				new ClassService(client)) as ServiceResult<T[typeof key]>;
		} else {
			servicesInvoked[key] = (await (service as FunctionService)(client)) as ServiceResult<T[typeof key]>;
		}
	}

	return {
		...servicesInvoked,
		plugins: new Plugins<T>({
			client,
			folder: plugins.folder,
			plugins: plugins.plugins,
		}),
		interactions: new Interactions({ client }),
	};
}
