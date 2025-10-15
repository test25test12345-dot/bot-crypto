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

console.log("================================");
console.log("BOT STARTING...");
console.log("RPC:", process.env.MAINNET_RPC);
console.log("Bot Token:", process.env.BOT_TOKEN ? "✓" : "✗");
console.log("Alerts Bot Token:", process.env.ALERTS_BOT_TOKEN ? "✓" : "✗");
console.log("Group Chat IDs:");
console.log("- GROUP_CHATID:", process.env.GROUP_CHATID);
console.log("- GROUP_CHATID1:", process.env.GROUP_CHATID1);
console.log("- GROUP_CHATID2:", process.env.GROUP_CHATID2);
console.log("Database:", process.env.DB_NAME);
console.log("================================");

bot.init(async (session: any, command: string, params: any, messageId: number) => {
    // Command handler
}, async (option: number, param: any) => {
    // Option handler
})

// Avvia il tracking dopo l'inizializzazione del bot
setTimeout(() => {
    console.log("Starting swap tracker...");
    track_swap.start();
}, 2000);
