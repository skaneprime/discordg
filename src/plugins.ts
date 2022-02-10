import { Plugin, EventsListeners } from "./client/modules/services/plugins";
import { ServiceObject } from "./client/modules/services";

/** @public */
export { Plugin, EventsListeners, ServiceObject };
/** @public */
export function createPlugin(plugin: Plugin) {
	return plugin;
}
