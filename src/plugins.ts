import { Config, Database } from "./client/modules/services/plugins/types";
import { Plugin, EventsListeners } from "./client/modules/services/plugins";
import { ServiceObject } from "./client/modules/services";

/** @public */
export { Plugin, EventsListeners, ServiceObject, Config, Database };
/** @public */
export function createPlugin<T extends ServiceObject>(plugin: Plugin<T>) {
	return plugin;
}
