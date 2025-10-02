
import * as bot from "./bot"
import * as afx from './global'
import { Connection, clusterApiUrl } from "@solana/web3.js";

import dotenv from 'dotenv'
dotenv.config()

const conn: Connection = new Connection(process.env.MAINNET_RPC as string, "confirmed");

afx.setWeb3(conn)
afx.setBotMode(afx.BotRunMode.Alerts)

bot.init(async (session: any, command: string, params: any, messageId: number) => {

}, async (option: number, param: any) => {

}) 

// poolDetector.start(conn)
