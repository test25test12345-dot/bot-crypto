
import * as bot from "./bot"
import { OptionCode } from "./bot"
import * as utils from './utils'
import * as database from './db'
import * as afx from './global'
import * as track_swap from "./detection/track-swap"
import { Connection, clusterApiUrl } from "@solana/web3.js";

import dotenv from 'dotenv'
import { connection } from "mongoose"
dotenv.config()

const conn: Connection = new Connection(process.env.MAINNET_RPC as string, 'confirmed');
afx.setWeb3(conn)

bot.init(async (session: any, command: string, params: any, messageId: number) => {

}, async (option: number, param: any) => {
})

track_swap.start()