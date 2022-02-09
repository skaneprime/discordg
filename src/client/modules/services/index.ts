import { Awaitable } from "discord.js";
import { Client } from "../..";

import { Plugins } from "./plugins";
import { Interactions } from "./interactions";

/** @public */
export type ServiceArgs<T extends ServiceObject = ServiceObject> = [Client<T>];
/** @public */
export type ClassService = Dingir.utils.class.Any<ServiceArgs> & {
	Invoke?: (...args: ServiceArgs) => Awaitable<unknown>;
};
/** @public */
export type FunctionService = Dingir.utils.function.Any<ServiceArgs>;
/** @public */
export type Service = FunctionService | ClassService;
/** @public */
export type ServiceResult<T extends Service> = Dingir.utils.promise.Result<
	Dingir.utils.types.ReturnOrInstance<T>
>;
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
	client: Client<T>,
	plugins: {
		folder: string;
	},
) {
	const servicesInvoked = {} as { [K in keyof T]: ServiceResult<T[K]> };

	for (const key in services) {
		const service = services[key];

		if (Dingir.utils.class.isClass(service)) {
			const ClassService = service as ClassService;
			servicesInvoked[key] = ((await ClassService.Invoke?.call({}, client as Client)) ||
				new ClassService(client as Client)) as ServiceResult<T[typeof key]>;
		} else {
			servicesInvoked[key] = (await (service as FunctionService)(
				client as Client,
			)) as ServiceResult<T[typeof key]>;
		}
	}

	return {
		...servicesInvoked,
		plugins: new Plugins<T>({
			client,
			folder: plugins.folder,
		}),
		interactions: new Interactions({ client }),
	};
}
