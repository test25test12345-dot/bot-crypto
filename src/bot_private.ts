import * as instance from './bot'
import {StateCode, OptionCode} from './bot'
import * as utils from './utils'
import * as afx from './global'
import * as uniconst from './uniconst'


import assert from 'assert'
import dotenv from 'dotenv'

dotenv.config()

/*
COMMAND
*/
export const procMessage = async (message: any, database: any) => {

	let chatid = message.chat.id.toString();
	let chatType = message.chat.type;
	let session = instance.sessions.get(chatid)
	let userName = message?.chat?.username;
	let messageId = message?.messageId

	if (message.photo) {
		console.log(message.photo)
		processSettings(message, database);
	}

	if (message.animation) {
		console.log(message.animation)
		processSettings(message, database);
	}

	if (!message.text)
		return;

	let command = message.text;
	if (message.entities) {
		for (const entity of message.entities) {
			if (entity.type === 'bot_command') {
				command = command.substring(entity.offset, entity.offset + entity.length);
				break;
			}
		}
	}

	if (command.startsWith('/')) {

		if (!session) {
			console.log(`@${userName} session has been permitted through whitelist`);

			session = await instance.createSession(chatid, userName, chatType);
			session.permit = 1;

			await database.updateUser(session)
		}

		if (userName && session.username !== userName) {
			session.username = userName
			await database.updateUser(session)
		}
		let params = message.text.split(' ');
		if (params.length > 0 && params[0] === command) {
			params.shift()
		}
		
		command = command.slice(1);
		if (command === instance.COMMAND_START) {
			//sendMessage
		} else {
			
			console.log(`Command Execute: /${command} ${params}`)
			if (instance._command_proc) {
				instance._command_proc(session, command, params, messageId)
			}
		}

		// instance.stateMap_remove(chatid)

	} else if (message.reply_to_message) {

		processSettings(message, database);
		await instance.removeMessage(chatid, message.message_id) //TGR
		await instance.removeMessage(chatid, message.reply_to_message.message_id)

	}
}

const processSettings = async (msg: any, database: any) => {

	const sessionId = msg.chat?.id.toString()

	const session = instance.sessions.get(sessionId)
	if (!session) {
		return
	}

	let stateNode = instance.stateMap_getFocus(sessionId)
	if (!stateNode) {
		instance.stateMap_setFocus(sessionId, StateCode.IDLE, { sessionId: sessionId })
		stateNode = instance.stateMap_get(sessionId)

		assert(stateNode)
	}

	const stateData = stateNode.data
		
	// if (stateNode.state === StateCode.WAIT_SET_MSG_LIMIT_HI_PRICE) {
		//Hard Coding according to ReplyMessage
	// }
}
