import Client, {
    CommitmentLevel,
    SubscribeRequestAccountsDataSlice,
    SubscribeRequestFilterAccounts,
    SubscribeRequestFilterBlocks,
    SubscribeRequestFilterBlocksMeta,
    SubscribeRequestFilterEntry,
    SubscribeRequestFilterSlots,
    SubscribeRequestFilterTransactions,
} from "@triton-one/yellowstone-grpc";
import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
import { getWallets } from "./wallets";
import { getJupiterSwapInfo } from "../jup-lib/jupiter-detection";
import bs58 from 'bs58'
import { LAMPORTS_PER_SOL, Message, PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { JUPITER_V6_PROGRAM_ID } from "../jup-lib/constant";
import { MIN_TARGET_WALLETS, RayLiqPoolv4 } from "../global";
import { decodeRaydiumTxn } from "../raydium-lib/raydium-detection";
import { decodeRaydiumCpmmTxn } from "../raydium-lib/raydium-cpmm-detection";
import { WSOL_ADDRESS, USDC_ADDRESS, USDT_ADDRESS } from "../uniconst";
import { TransactionFormatter } from "./transaction-formatter";
import * as database from '../db'
import { getTokenPrice_, getTokenMcap, delayForTrxSync, getTokenInfo, getWalletTokenBalance, getTokenScore } from "../utils";
import * as instance from '../bot'
import { decodePumpfunTxn, PUMP_FUN_PROGRAM_ID } from "../pumpfun-lib/pumpfun-detection";
import { wallets } from "./config";
import { getMint } from "@solana/spl-token";
import * as afx from '../global'
import { Token } from "graphql";
import { tokenToString } from "typescript";
import path from 'path';
import fs from 'fs';

const birdeyeApi: any = require("api")("@birdeyedotso/v1.0#crnv83jlti6buqu");
birdeyeApi.auth(process.env.BIRDEYE_API_KEY);

const logToFile = (message: string) => {
    const logFilePath = path.join(__dirname, 'logs', 'track.log');
    const logMessage = `${message}\n`;
    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
};

interface SubscribeRequest {
    accounts: { [key: string]: SubscribeRequestFilterAccounts };
    slots: { [key: string]: SubscribeRequestFilterSlots };
    transactions: { [key: string]: SubscribeRequestFilterTransactions };
    transactionsStatus: { [key: string]: SubscribeRequestFilterTransactions };
    blocks: { [key: string]: SubscribeRequestFilterBlocks };
    blocksMeta: { [key: string]: SubscribeRequestFilterBlocksMeta };
    entry: { [key: string]: SubscribeRequestFilterEntry };
    commitment?: CommitmentLevel | undefined;
    accountsDataSlice: SubscribeRequestAccountsDataSlice[];
    ping?: SubscribeRequestPing | undefined;
}

const TXN_FORMATTER = new TransactionFormatter();

const checkDB_Alert = async (buyWallets: any, old: any, swapData: any) => {
    const sellWallets: any = await buyWallets.filter((wallet: any) => wallet.type === "sell")
    const tokenMCap: string = await getTokenMcap(swapData)
    const tokenInfo: any = await getTokenInfo(swapData)
    const solPrice: any = await getTokenPrice_(swapData.inMint)
    console.log("solprice=====", solPrice)
    // const extensions: any = tokenInfo.data.extensions
    const extensions: any = tokenInfo.data?.extensions ?? null
    const positionTradeScore = await getTokenScore(buyWallets, swapData)
    console.log("buyWallets=====", buyWallets)

    // buyWallets.sort((a: any, b: any) => Date.parse(b.txTime) - Date.parse(a.txTime));
    buyWallets.sort((a: any, b: any) => {
        if (a > b) {
            return -1; // a should come before b
        } else if (a < b) {
            return 1; // b should come before a
        }
        return 0; // a and b are equal
    });

    logToFile(`parsedTxn================== ${JSON.stringify(swapData.outMint)}, ${JSON.stringify(tokenInfo.data?.name)}`);

    let message = ``
    // 💰📈🍏🍏🟢🔴🔗🐸🚀🚀🐂��💸🛰💊🦚💸
    // 💸 <b>New smart holder entry ${old === false ? "- New Token Detected" : ""}</b>

    message = `
    ${message} 
💸 <b>New smart holder entry</b>

🔎 <b>Address</b>: <code>${swapData.outMint}</code>
💰 <b>Name</b>: ${tokenInfo.data?.name ?? " "}
📈 <b>MCap</b>: ${tokenMCap}`

    if (extensions && extensions.website) {
        message =
            `${message}
🔗 <a href="${extensions.website}">Website</a>`
    }
    if (extensions && extensions.twitter) {
        message =
            `${message}        
🔗 <a href="${extensions.twitter}">Twitter</a>`
    }
    if (extensions && extensions.telegram) {
        message =
            `${message}        
🔗 <a href="${extensions.telegram}">Telegram</a>`
    }
    if (extensions && extensions.discord) {
        message =
            `${message}        
🔗 <a href="${extensions.discord}">Discord</a>`
    }

    message = `
    ${message}

💯 <b>TradeScore</b>: ${positionTradeScore}
`
    message = `${message}
🦚 <b>${buyWallets.length - sellWallets.length} smart holders</b> `
    for (let i = 0; i < buyWallets.length; i++) {
        if (buyWallets[i].type === "buy") {
            console.log("buybalance===", buyWallets[i].inAmount, solPrice, buyWallets[i].txTime)

            message = `${message}
🟢 ${buyWallets[i].name}  ($${(buyWallets[i].inAmount / 10 ** 9 * solPrice).toFixed(0)}) (${buyWallets[i].txTime})`
        }
    }

    // if (sellWallets.length > 0) {
    message = `${message}

❗ <b>${sellWallets.length} close</b>`
    for (let i = 0; i < buyWallets.length; i++) {
        if (buyWallets[i].type === "sell")
            message = `${message}
🔴 ${buyWallets[i].name}`
    }
    // }

    // QUESTA PARTE DEVE ESSERE DENTRO LA FUNZIONE
    message =
        `${message}

⚡ <a href="https://jup.ag/swap/${swapData.outMint}-SOL">Jupiter</a>
🐸 <a href="https://gmgn.ai/sol/token/${swapData.outMint}">Gmgn</a>
🚀 <a href="https://photon-sol.tinyastro.io/en/lp/${swapData.outMint}">Photon</a>
🐂 <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=${swapData.outMint}">Bullx</a>`

    instance.sendInfoMessage(process.env.GROUP_CHATID, message)
    instance.sendInfoMessage(process.env.GROUP_CHATID1, message)
    instance.sendInfoMessage(process.env.GROUP_CHATID2, message)
} // PARENTESI GRAFFA DI CHIUSURA DELLA FUNZIONE

const processSwapData = async (swap_data: any) => {
    if (!swap_data) {
        return
    }
    console.log("swap_data=======", swap_data)

    const db_wallet: any = await database.selectTrackWallet({ wallet: swap_data.owner })
    if (!db_wallet) {
        console.log("Doesn't match owner wallet", swap_data.owner, swap_data.signature)
        return
    }
    if (swap_data.inMint === WSOL_ADDRESS) {
        if (swap_data.outMint === USDC_ADDRESS || swap_data.outMint === USDT_ADDRESS)
            return
        const date = new Date()
        const buytxTime = new Date();

        let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.outMint)
        if (token_index < 0)
            db_wallet.tokens.push({
                mint: swap_data.outMint, type: "buy", txTime: buytxTime.toLocaleString('en-US', {
                    hour12: false,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }), inAmount: swap_data.inAmount
            })
        else {
            db_wallet.tokens[token_index].type = "buy"
            db_wallet.tokens[token_index].txTime = buytxTime.toLocaleString('en-US', {
                hour12: false,         // 24-hour format
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
            db_wallet.tokens[token_index].inAmount = Number(db_wallet.tokens[token_index].inAmount) + Number(swap_data.inAmount)
        }

        await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name })

        const buyPosition: any = await database.selectTrackPosition({ token: swap_data.outMint })

        let openPosition: Boolean = false
        if (buyPosition && buyPosition.token) {
            openPosition = true
            let wallet_index: any = buyPosition.wallets.findIndex((wallet: any) => wallet.address === swap_data.owner)
            // let count_flag = false;
            if (wallet_index < 0) {
                // count_flag = true;
                buyPosition.wallets.push({
                    address: swap_data.owner, type: "buy", name: db_wallet.name, inAmount: swap_data.inAmount, txTime: buytxTime.toLocaleString('en-US', {
                        hour12: false,         // 24-hour format
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })
                })
            }
            else {
                buyPosition.wallets[wallet_index].type = "buy"
                buyPosition.wallets[wallet_index].inAmount = swap_data.inAmount
                buyPosition.wallets[wallet_index].txTime = buytxTime.toLocaleString('en-US', {
                    hour12: false,         // 24-hour format
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })
            }

            // await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets, old: true, firstTxTime:buyPosition.secondTxTime , secondTxTime:Date.now() })
            const buysInPosition_old: any = buyPosition.wallets.filter((wallet: any) => wallet.type === "buy")
            await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets, old: true })
            const buysInPosition: any = buyPosition.wallets.filter((wallet: any) => wallet.type === "buy")

            if (buysInPosition && buysInPosition.length >= 3 && buysInPosition_old?.length != buysInPosition.length) {
                await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data)
            }
            else if (buysInPosition.length < 3) {
                await database.removeTrackPosition({ token: swap_data.outMint })
                openPosition = false
            }
        }

        if (!openPosition) {
            let buycount = 0
            let buyWallets: any = []
            const trackWallets: any = await database.selectTrackWallets({})
            for (const wallet of trackWallets) {
                for (const token of wallet.tokens) {
                    if (token.mint === swap_data.outMint && token.type === "buy") {
                        buycount++
                        buyWallets.push({ address: wallet.wallet, type: "buy", name: wallet.name, inAmount: token.inAmount, txTime: token.txTime })
                    }
                }

                // let duration = buyPosition?(Date.now() - buyPosition.firstTxTime):Date.now()
                if (buycount >= 3 && buyWallets.length >= 3) {
                    console.log("status 2===== ", buyWallets.length);
                    // await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false, firstTxTime:buyPosition.secondTxTime , secondTxTime:Date.now() })
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false })
                    await checkDB_Alert(buyWallets, buyPosition?.old, swap_data)
                    break
                }
            }
        }
    } else {
        // const tokenInfo = await getMint(afx.web3Conn, new PublicKey(swap_data.inMint))
        // const prevBalance = await getWalletTokenBalance(swap_data.owner, swap_data.inMint, tokenInfo.decimals)
        // let sellPercent = Number(swap_data.inAmount) / (10 ** tokenInfo.decimals) / prevBalance * 100
        // sellPercent = sellPercent > 100 ? 100 : sellPercent
        if (swap_data.inMint === USDC_ADDRESS || swap_data.inMint === USDT_ADDRESS)
            return
        // let solPrice: any = await getTokenPrice_(swap_data.outMint)
        let solPrice: any = await getTokenPrice_(WSOL_ADDRESS)

        let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.inMint)
        let sellAvailable = false;

        if (token_index >= 0) {
            if ((Number(db_wallet.tokens[token_index].inAmount) - Number(swap_data.outAmount)) / 10 ** 9 * solPrice < 60) {
                db_wallet.tokens[token_index].type = "sell"
                db_wallet.tokens[token_index].inAmount = Number(db_wallet.tokens[token_index].inAmount) - Number(swap_data.inAmount)
                if (Number(db_wallet.tokens[token_index].inAmount) < 0) db_wallet.tokens[token_index].inAmount = 0
                await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name })
                sellAvailable = true
            }
        }

        if (sellAvailable) {
            const sellPosition: any = await database.selectTrackPosition({ token: swap_data.inMint })
            if (sellPosition) {
                let wallet_index: any = sellPosition.wallets.findIndex((wallet: any) => wallet.address === swap_data.owner)
                if (wallet_index >= 0) {
                    sellPosition.wallets[wallet_index].type = "sell"
                    await database.updateTrackPosition({ token: swap_data.inMint, wallets: sellPosition.wallets, old: true })
                }
            }
        }

        await delayForTrxSync(swap_data.signature)
    }
}

const parseTransfer = async (txn: any) => {
    try {
        const logMessages = txn.meta.logMessages
        const owner = txn.transaction.message.versioned ? new PublicKey(Buffer.from(txn.transaction.message.accountKeys[0], "base64")) : Buffer.from(txn.transaction.message.accountKeys[0], "base64")
        for (let message of logMessages) {
            if (!message.includes("11111111111111111111111111111111")) {
                return
            }
        }

        const preBalances = txn.meta.preBalances
        const postBalances = txn.meta.postBalances
        if (preBalances && postBalances && preBalances.length > 3 && postBalances.length > 3 && preBalances.length === postBalances.length) {
            let count = 0
            let message = `owner: ${owner}`
            for (let i = 1; i < preBalances.length - 2; i++) {
                count++
                const trasferAmount = (Number(postBalances[i]) - Number(preBalances[i])) / (10 ** 9)
                message = `${message}
    Amount: ${trasferAmount} SOL`
            }
            message = `🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢
            User transfered ${count} times
    ${message}`
            if (count > 0) {
                // You can uncomment this if you want to log transfers
                // console.log(message)
            }
        }
    } catch (error) {
        console.log("Transfer detection error", error, txn)
    }
}

const parseTransaction = async (data: any) => {
    try {
        if (data.filters.some((item: string) => item == 'subscribe_tx') && data.transaction) {
            const txn = TXN_FORMATTER.formTransactionFromJson(
                data.transaction,
                Date.now(),
            );

            const accountKeys = txn.transaction.message.staticAccountKeys
            const hasJupiter = accountKeys.find((programId: PublicKey) => {
                if (programId.equals(JUPITER_V6_PROGRAM_ID)) {
                    return true
                } else {
                    return false
                }
            })
            if (hasJupiter) {
                const ret = await getJupiterSwapInfo(txn)
                processSwapData(ret)
                return
            }
            const hasCpmm = accountKeys.find((programId: PublicKey) => {
                if (programId.equals(new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"))) {
                    return true
                } else {
                    return false
                }
            })
            if (hasCpmm) {
                const txn = TXN_FORMATTER.formTransactionFromJson(
                    data.transaction,
                    Date.now()
                );
                const ret = await decodeRaydiumCpmmTxn(txn)
                processSwapData(ret)
                return
            }

            const hasRaydium = accountKeys.find((programId: PublicKey) => {
                if (programId.equals(RayLiqPoolv4)) {
                    return true
                } else {
                    return false
                }
            })

            if (hasRaydium) {
                const txn = TXN_FORMATTER.formTransactionFromJson(
                    data.transaction,
                    Date.now()
                );

                const ret = await decodeRaydiumTxn(txn)
                processSwapData(ret)
                return
            }
            const hasPumpFun = accountKeys.find((programId: PublicKey) => {
                if (programId.equals(PUMP_FUN_PROGRAM_ID)) {
                    return true
                } else {
                    return false
                }
            })
            if (hasPumpFun) {
                const ret = await decodePumpfunTxn(txn)
                processSwapData(ret)
                return
            }
        }
        if (data.transaction !== undefined) {
            const ret = await parseTransfer(data.transaction["transaction"])
        }
    } catch (error) {
        console.error("Error in parseTransaction:", error)
    }
}

async function handleStream(client: Client, args: SubscribeRequest) {
    // Subscribe for events
    const stream = await client.subscribe();

    // Create `error` / `end` handler
    const streamClosed = new Promise<void>((resolve, reject) => {
        stream.on("error", (error) => {
            console.log("ERRRORORROROROR", error);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            resolve();
        });
        stream.on("close", () => {
            resolve();
        });
    });

    // Handle updates
    stream.on("data", (data) => {
        parseTransaction(data)
    });

    // Send subscribe request
    await new Promise<void>((resolve, reject) => {
        stream.write(args, (err: any) => {
            if (err === null || err === undefined) {
                resolve();
            } else {
                reject(err);
            }
        });
    }).catch((reason) => {
        console.error(reason);
        throw reason;
    });

    await streamClosed;
}

async function subscribeCommand(client: Client, args: SubscribeRequest) {
    while (true) {
        try {
            console.log("Start Substream server")
            await handleStream(client, args);
        } catch (error) {
            console.error("Stream error, restarting in 1 second...", error);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

const client = new Client('https://grpc.eu.shyft.to', process.env.GRPC_TOKEN, undefined);
export const start = async () => {
    let detection_wallets: string[] = await getWallets()
    const req: SubscribeRequest = {
        accounts: {},
        slots: {},
        transactions: {
            subscribe_tx: {
                vote: false,
                failed: false,
                signature: undefined,
                accountInclude: detection_wallets,
                // accountInclude: [],
                accountExclude: [],
                accountRequired: [],
            },
        },
        transactionsStatus: {},
        entry: {},
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        ping: undefined,
        commitment: CommitmentLevel.CONFIRMED,
    };
    subscribeCommand(client, req);
}
