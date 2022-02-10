import * as Discord from '../build/discord@0.9.6';

export default Discord.Plugins.createPlugin(function My2Plugin() {
    return {
        onMessageCreate(msg) {
            console.log(msg.author.tag, msg.content)
        },
        onDebug(msg) {
            console.log(msg)
        }
    }
})