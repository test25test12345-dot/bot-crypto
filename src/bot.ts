import assert from 'assert';
import dotenv from 'dotenv'
dotenv.config()

import * as database from './db'
import * as privateBot from './bot_private'
import * as afx from './global'
import * as utils from './utils'


import TelegramBot from 'node-telegram-bot-api'

import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";

export const COMMAND_START = 'start'

export enum OptionCode {
	BACK = -100,
	CLOSE,
	TITLE,
	WELCOME = 0,
	MAIN_MENU,
	MAIN_BUY,
	MAIN_SELL,
	MAIN_HELP,
	MAIN_REFERRAL,
	MAIN_ALERTS,
	MAIN_WALLET,
	MAIN_SETTINGS,
	MAIN_DCA,
	MAIN_REFRESH,
	WALLET_SOLSCAN,
	WALLET_DEPOSIT_SOL,
	WALLET_WITHDRAW_ALL_SOL,
	WALLET_WITHDRAW_X_SOL,
	WALLET_RESET_WALLET,
	WALLET_EXPORT_KEY,
	WALLET_REFRESH,
	WALLET_EXPORT_KEY_CONFIRM,
	WALLET_WITHDRAW_CONFIRM,
	SETTINGS_ANNOUNCE,
	SETTINGS_MIN_POS_VALUE,
	SETTINGS_AUTOBUY,
	SETTINGS_AUTOBUY_AMOUNT,
	SETTINGS_BUYCONFIG_LEFT,
	SETTINGS_BUYCONFIG_RIGHT,
	SETTINGS_SELLCONFIG_LEFT,
	SETTINGS_SELLCONFIG_RIGHT,
	SETTINGS_MAXPRICEIMPACT,
	SETTINGS_SLIPPAGE_BUY,
	SETTINGS_SLIPPAGE_SELL,
	SETTINGS_MEV_PROTECT,
	SETTINGS_TRX_PRIORITY,
	SETTINGS_TRX_PRIORITY_VALUE,
	BOTS_MENU,
	CHAT_MENU,
	MSG_GETTOKENINFO,
	MSG_REFRESH,
	MSG_BUYLEFT,
	MSG_BUYRIGHT,
	MSG_BUYXAMOUNT,
	MSG_BUY_DCA,
	PANEL_REFRESH,
	PANEL_SELLLEFT,
	PANEL_SELLRIGHT,
	PANEL_SELLXAMOUNT,
	PANEL_SELL_DCA,
	PANEL_SELL_AUTO,
	PANEL_DELETE,
	PANEL_DELETE_CONFIRM,
	PANEL_PREV,
	PANEL_NEXT,
	PANEL_LIMIT_HI,
	PANEL_LIMIT_HI_PRICE,
	PANEL_LIMIT_HI_PERCENT,
	PANEL_LIMIT_LO,
	PANEL_LIMIT_LO_PRICE,
	PANEL_LIMIT_LO_PERCENT,
	PANEL_MENU,

	DCA_CREATE_BUYORDER,
	DCA_CREATE_SELLORDER,
	DCA_DEPOSIT,
	DCA_WITHDRAW,
	DCA_CLOSE_ORDER,
	DCA_CLOSE_ORDER_CONFIRM,
	DCA_REFRESH,
	DCA_ORDER_DETAIL,
	DCA_ORDER_DETAIL_REFRESH,
}

export enum StateCode {
	IDLE = 1000,
	WAIT_SET_WALLET_WITHDRAW_ADDRESS,
	WAIT_SET_SETTINGS_MIN_POS_VALUE,
	WAIT_SET_SETTINGS_AUTOBUY_AMOUNT,
	WAIT_SET_SETTINGS_BUYCONFIG_LEFT_VALUE,
	WAIT_SET_SETTINGS_BUYCONFIG_RIGHT_VALUE,
	WAIT_SET_SETTINGS_SELLCONFIG_LEFT_VALUE,
	WAIT_SET_SETTINGS_SELLCONFIG_RIGHT_VALUE,
	WAIT_SET_SETTINGS_SLIPPAGE_BUY,
	WAIT_SET_SETTINGS_SLIPPAGE_SELL,
	WAIT_SET_SETTINGS_MAXPRICEIMPACT,
	WAIT_SET_SETTINGS_TRXPRIORITY_VALUE,
	WAIT_SET_WALLET_WITHDRAW_AMOUNT,
	WAIT_SET_MSG_BUYXAMOUNT,
	WAIT_SET_PANEL_SELLXAMOUNT,

	WAIT_SET_DCA_NAME,
	WAIT_SET_DCA_INITIAL_DEPOSIT,
	WAIT_SET_DCA_AMOUNT_PER_CYCLE,
	WAIT_SET_DCA_CYCLE_FREQ,
	WAIT_SET_DCA_TOKENADDRESS,
	WAIT_SET_DCA_DEPOSIT,
	WAIT_SET_DCA_WITHDRAW,

	WAIT_SET_ANNOUNCE_TEXT,

	WAIT_SET_MSG_LIMIT_LO_PERCENT,
	WAIT_SET_MSG_LIMIT_LO_PRICE,
	WAIT_SET_MSG_LIMIT_HI_PERCENT,
	WAIT_SET_MSG_LIMIT_HI_PRICE,
}

export let bot: TelegramBot
export let myInfo: TelegramBot.User
export const sessions = new Map()
export const stateMap = new Map()

const options = {method: 'GET', headers: {accept: 'application/json', 'x-chain': 'solana'}};

export const stateMap_setFocus = (chatid: string, state: any, data: any = {}) => {

	let item = stateMap.get(chatid)
	if (!item) {
		item = stateMap_init(chatid)
	}

	if (!data) {
		let focusData = {}
		if (item.focus && item.focus.data) {
			focusData = item.focus.data
		}

		item.focus = { state, data: focusData }
	} else {
		item.focus = { state, data }
	}

	// stateMap.set(chatid, item)
}

export const stateMap_getFocus = (chatid: string) => {
	const item = stateMap.get(chatid)
	if (item) {
		let focusItem = item.focus
		return focusItem
	}

	return null
}

export const stateMap_init = (chatid: string) => {

	let item = {
		focus: { state: StateCode.IDLE, data: { sessionId: chatid } },
		message: new Map()
	}

	stateMap.set(chatid, item)

	return item
}

export const stateMap_setMessage_Id = (chatid: string, messageType: number, messageId: number) => {

	let item = stateMap.get(chatid)
	if (!item) {
		item = stateMap_init(chatid)
	}

	item.message.set(`t${messageType}`, messageId)
	//stateMap.set(chatid, item)
}

export const stateMap_getMessage = (chatid: string) => {
	const item = stateMap.get(chatid)
	if (item) {
		let messageItem = item.message
		return messageItem
	}

	return null
}

export const stateMap_getMessage_Id = (chatid: string, messageType: number) => {
	const messageItem = stateMap_getMessage(chatid)
	if (messageItem) {

		return messageItem.get(`t${messageType}`)
	}

	return null
}

export const stateMap_get = (chatid: string) => {
	return stateMap.get(chatid)
}

export const stateMap_remove = (chatid: string) => {
	stateMap.delete(chatid)
}

export const stateMap_clear = () => {
	stateMap.clear()
}

const json_buttonItem = (key: string, cmd: number, text: string) => {
	return {
		text: text,
		callback_data: JSON.stringify({ k: key, c: cmd }),
	}
}

export const removeMenu = async (chatId: string, messageType: number) => {

	const msgId = stateMap_getMessage_Id(chatId, messageType)

	if (msgId) {

		try {

			await bot.deleteMessage(chatId, msgId)

		} catch (error) {
			//afx.errorLog('deleteMessage', error)
		}
	}
}

export const removeMessage = async (sessionId: string, messageId: number) => {

	if (sessionId && messageId) {
		try {
			await bot.deleteMessage(sessionId, messageId)
		} catch (error) {
			//console.error(error)
		}
	}
}

export const sendReplyMessage = async (chatid: string, message: string) => {
	try {

		let data : any = { parse_mode: 'HTML', disable_forward: true, disable_web_page_preview: true, reply_markup: { force_reply: true } }

		const msg = await bot.sendMessage(chatid, message, data)
		return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null }

	} catch (error) {

		afx.errorLog('sendReplyMessage', error)
		return null
	}
}

export const sendMessage = async (chatid: string, message: string, info: any = {}) => {
	try {

		let data : any = { parse_mode: 'HTML' }

		data.disable_web_page_preview = true
		data.disable_forward = true

		if (info && info.message_thread_id) {
			data.message_thread_id = info.message_thread_id
		}

		const msg = await bot.sendMessage(chatid, message, data)
		return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null }

	} catch (error: any) {

		if (error.response && error.response.body && error.response.body.error_code === 403) {
			info.blocked = true;
			if (error?.response?.body?.description == 'Forbidden: bot was blocked by the user') {
				database.removeUser({chatid});
				sessions.delete(chatid);
			}
		}

		console.log(error?.response?.body)
		afx.errorLog('sendMessage', error)
		return null
	}
}

export const sendInfoMessage = async (chatid: string, message: string) => {

	let json = [
		[
			// json_buttonItem(chatid, OptionCode.CLOSE, '✖️ Close')
		],
	]

	return sendOptionMessage(chatid, message, json)
}

export const sendOptionMessage = async (chatid: string, message: string, option: any) => {
	try {

		const keyboard = {
			inline_keyboard: option,
			resize_keyboard: true,
			one_time_keyboard: true,
		};

		const msg = await bot.sendMessage(chatid, message, { reply_markup: keyboard, disable_web_page_preview: true, parse_mode: 'HTML' });
		return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null }

	} catch (error) {
		afx.errorLog('sendOptionMessage', error)

		return null
	}
}

export async function sendPhoto(chatid: string, file_id: string, message: string, json_buttons : any = null) {

	//, protect_content: true
	let option: any = { caption: message, parse_mode: 'HTML', disable_web_page_preview: true }

	if (json_buttons) {

		const keyboard = {
			inline_keyboard: json_buttons.options,
			resize_keyboard: true,
			one_time_keyboard: true,
			force_reply: true
		};

		option.reply_markup = keyboard
	}

	return new Promise(async (resolve, reject) => {
		bot.sendPhoto(chatid, file_id, option).catch((err) => {
			console.log('\x1b[31m%s\x1b[0m', `sendPhoto Error: ${chatid} ${err.response.body.description}`);
			resolve(null)
		}).then((msg: any) => {
			resolve({ messageId: msg.message_id, chatid: msg.chat.id })
		});
	})
}

export async function sendText(chatid: string, message: string, json_buttons: any = null) {

	//, protect_content: true
	let option: any = { parse_mode: 'HTML', disable_web_page_preview: true }

	if (json_buttons !== null) {

		const keyboard = {
			inline_keyboard: json_buttons.options,
			resize_keyboard: true,
			one_time_keyboard: true,
			force_reply: true
		};

		option.reply_markup = keyboard
	}

	return new Promise(async (resolve, reject) => {
		bot.sendMessage(chatid, message, option).then((msg) => {
			resolve({ messageId: msg.message_id, chatid: msg.chat.id })
		}).catch((err) => {
			console.log('\x1b[31m%s\x1b[0m', `sendText Error: ${chatid} ${err.response.body.description}`);
			resolve(null)
		})
	})
}

export const json_info = async (sessionId: string, msg: string) => {

	let json = [
		[
			json_buttonItem(sessionId, OptionCode.CLOSE, '✖️ Close')
		],

	]
	return { title: msg, options: json };
}

export const json_confirm = async (sessionId: string, msg: string, btnCaption: string, btnId: number, itemData: string = '') => {

	const session = sessions.get(sessionId)
	if (!session) {
		return null
	}

	const title = msg

	let json = [
		[
			json_buttonItem(sessionId, OptionCode.CLOSE, '✖️ Close'),
			json_buttonItem(itemData, btnId, btnCaption)
		],

	]
	return { title: title, options: json };
}

export const createSession = async (chatid: string, username: string, type: string) => {

	let session: any = {}
	
	session.chatid = chatid
	session.username =  username
	session.type = type

	await setDefaultSettings(session)

	sessions.set(session.chatid, session)
	showSessionLog(session)

	return session;
}

export function showSessionLog(session: any) {

	if (session.type === 'private') {
		console.log(`@${session.username} user${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`)
	} else if (session.type === 'group') {
		console.log(`@${session.username} group${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`)
	} else if (session.type === 'channel') {
		console.log(`@${session.username} channel${session.wallet ? ' joined' : '\'s session has been created'}`)
	}
}

export const defaultConfig = {
	admin: 0,
	vip: 0,
}


export const getTokenMcap = async (swap_data: any) => {
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      };
      
      const fetchUrl: string = "https://public-api.birdeye.so/defi/v3/token/market-data?address="+swap_data
            
      const responseData = await fetch(fetchUrl, options)
        .then(res => res.json())
    
    let formattedMcap: string;
    if (responseData.data.marketcap > 10**6) {
        formattedMcap = (responseData.data.marketcap / 10**6).toFixed(1) + 'M';  // If greater than 1 million, show in millions
    } else if (responseData.data.marketcap > 10**3) {
        formattedMcap = (responseData.data.marketcap / 10**3).toFixed(1) + 'K';  // If greater than 1 thousand, show in thousands
    } else {
        formattedMcap = responseData.data.marketcap.toFixed(0);  // If less than 1 thousand, show the value as it is
    }

    return formattedMcap
}


export const setDefaultSettings = async (session: any) => {
	session.admin = defaultConfig.admin
	session.timestamp = new Date().getTime()
}

export let _command_proc: any = null
export let _callback_proc: any = null
export async function init(command_proc: any, callback_proc: any) {

	console.log(`Bot is running as ${afx.BotMode} mode`)	
	
	// const mcap = await getTokenMcap("A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump")
	// console.log("mcap====", mcap)


	
	const token: string = String(afx.getBotToken())
	console.log(afx.BotMode, token)

	bot = new TelegramBot(token,
		{
			polling: true
		})
		
	bot.getMe().then((info: TelegramBot.User) => {
		myInfo = info
	});

	if (afx.getBotMode() === afx.BotRunMode.Main) {
		bot.on('message', async (message: any) => {	
			console.log("message===", message)
			const msgType = message?.chat?.type;
			if (msgType === 'private') {
				privateBot.procMessage(message, database);
	
			} else if (msgType === 'group' || msgType === 'supergroup') {
				privateBot.procMessage(message, database);
			} else if (msgType === 'channel') {
				privateBot.procMessage(message, database);
			}
		})
	
		bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {	
	
			const message = callbackQuery.message;
	
			if (!message) {
				return
			}
	
			const option = JSON.parse(callbackQuery.data as string);
			let chatid = message.chat.id.toString();
	
			executeCommand(chatid, message.message_id, callbackQuery.id, option)
		})
	}

	_command_proc = command_proc
	_callback_proc = callback_proc

	await database.init()
	const users: any = await database.selectUsers()

	let loggedin = 0
	let admins = 0
	for (const user of users) {

		let session = JSON.parse(JSON.stringify(user))
		session = utils.objectDeepCopy(session, ['_id', '__v'])

		if (session.wallet) {
			loggedin++
		}

		sessions.set(session.chatid, session)
		//showSessionLog(session)

		if (session.admin >= 1) {
			console.log(`@${session.username} user joined as ADMIN ( ${session.chatid} )`)
			admins++
		}
	}

	console.log(`${users.length} users, ${loggedin} logged in, ${admins} admins`)
}


export const reloadCommand = async (chatid: string, messageId: number, callbackQueryId: string, option: any) => {

	await removeMessage(chatid, messageId)
	executeCommand(chatid, messageId, callbackQueryId, option)
}

export const executeCommand = async (chatid: string, _messageId: number | undefined, _callbackQueryId: string | undefined, option: any) => {

	const cmd = option.c;
	const id = option.k;

	const session = sessions.get(chatid)
	if (!session) {
		return
	}

	//stateMap_clear();

	let messageId = Number(_messageId ?? 0)
	let callbackQueryId = _callbackQueryId ?? ''

	const sessionId: string = chatid
	const stateData: any = { sessionId,  messageId, callbackQueryId, cmd }

	try {
		// if (cmd === OptionCode.MainMenu) {
			//Hard Coding for event			
		// }

	} catch (error) {
		console.log(error)
		sendMessage(chatid, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
		if (callbackQueryId)
			await bot.answerCallbackQuery(callbackQueryId, { text: `😢 Sorry, there was some errors on the command. Please try again later 😉` })
	}
}