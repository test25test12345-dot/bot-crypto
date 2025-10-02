import dotenv from 'dotenv'
dotenv.config()

import { Connection } from "@solana/web3.js";
// import { isUnparsedSource } from 'typescript';
import { PublicKey } from '@solana/web3.js';
import { ENV } from '@solana/spl-token-registry';

export const NOT_ASSIGNED = '- Not assigned -'

export const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS
export const RayLiqPoolv4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')

export const rankingEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']

export const errorLog = (summary: string, error: any): void => {
    if (error?.response?.body?.description) {
        console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error.response.body.description}`);
    } else {
        console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error}`);
    }
};

export const parseError = (error: any): string => {
    let msg = '';
    try {
        error = JSON.parse(JSON.stringify(error));
        msg =
            error?.error?.reason ||
            error?.reason ||
            JSON.parse(error)?.error?.error?.response?.error?.message ||
            error?.response ||
            error?.message ||
            error;
    } catch (_error) {
        msg = error;
    }

    return msg;
};

export enum BotRunMode {
	Main = "Swap",
	Alerts = "Alerts",
}

export const TradingMonitorDuration = 24 * 60 * 60
export const Max_Sell_Count = 10
export const Default_Swap_Heap = 0.001
export const MIN_TARGET_WALLETS = 3

export const Mainnet = 'mainnet-beta'
export const Testnet = 'testnet'
export const Devnet = 'devnet'

export let BotMode: BotRunMode = BotRunMode.Main

export let web3Conn : Connection

export const setWeb3 = (conn: Connection) => {

	web3Conn = conn
}

export const setBotMode = (mode: BotRunMode) => {

	BotMode = mode
}

export const getBotMode = () => {

	return BotMode
}

export const getBotToken = () : string => {

    if (BotMode === BotRunMode.Main) {
        return process.env.BOT_TOKEN ?? ''
    } else {
        return process.env.ALERTS_BOT_TOKEN ?? ''
    }
}

export const get_net_mode = () => {

	return Number(process.env.NET_MODE)
}

export const REQUEST_LIMIT = 60000 // 1 minutes
export const VALID_LIMIT = 600000 // 10 minutes
export const DELETE_TIME = 300000 // 5 minutes

export const DEFAULT_BULLET_EMOJI = '🟢'