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
import TelegramBot from 'node-telegram-bot-api'

const alertBot = new TelegramBot(process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN || '', {polling: false});

const sendAlert = async (chatId: string, message: string) => {
    try {
        const utf8Message = Buffer.from(message, 'utf8').toString('utf8');
        await alertBot.sendMessage(chatId, utf8Message, { 
            parse_mode: 'HTML', 
            disable_web_page_preview: true 
        });
        console.log('Alert sent to:', chatId);
    } catch (error: any) {
        console.error('Failed to send to:', chatId, error.message);
    }
};

const birdeyeApi: any = require("api")("@birdeyedotso/v1.0#crnv83jlti6buqu");
birdeyeApi.auth(process.env.BIRDEYE_API_KEY);

const logToFile = (message: string) => {
    try {
        const logDir = path.join(__dirname, 'logs');
        const logFilePath = path.join(logDir, 'track.log');
        
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
            console.log('Created logs directory:', logDir);
        }
        
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        
        fs.appendFileSync(logFilePath, logMessage, 'utf8');
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
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
    try {
        const sellWallets: any = await buyWallets.filter((wallet: any) => wallet.type === "sell")
        const tokenMCap: string = await getTokenMcap(swapData)
        const tokenInfo: any = await getTokenInfo(swapData)
        const solPrice: any = await getTokenPrice_(swapData.inMint)
        console.log("solprice=====", solPrice)
        const extensions: any = tokenInfo.data?.extensions ?? null
        const positionTradeScore = await getTokenScore(buyWallets, swapData)
        console.log("buyWallets=====", buyWallets)

        buyWallets.sort((a: any, b: any) => {
            if (a > b) {
                return -1;
            } else if (a < b) {
                return 1;
            }
            return 0;
        });

        logToFile(`parsedTxn================== ${JSON.stringify(swapData.outMint)}, ${JSON.stringify(tokenInfo.data?.name)}`);

        let message = '';
        
        message = message + '\n\u{1F4B8} <b>New smart holder entry</b>\n';
        message = message + '\n\u{1F50E} <b>Address</b>: <code>' + swapData.outMint + '</code>';
        message = message + '\n\u{1F4B0} <b>Name</b>: ' + (tokenInfo.data?.name ?? " ");
        message = message + '\n\u{1F4C8} <b>MCap</b>: ' + tokenMCap;

        if (extensions && extensions.website) {
            message = message + '\n\u{1F517} <a href="' + extensions.website + '">Website</a>';
        }
        if (extensions && extensions.twitter) {
            message = message + '\n\u{1F517} <a href="' + extensions.twitter + '">Twitter</a>';
        }
        if (extensions && extensions.telegram) {
            message = message + '\n\u{1F517} <a href="' + extensions.telegram + '">Telegram</a>';
        }
        if (extensions && extensions.discord) {
            message = message + '\n\u{1F517} <a href="' + extensions.discord + '">Discord</a>';
        }

        message = message + '\n\n\u{1F4AF} <b>TradeScore</b>: ' + positionTradeScore;
        message = message + '\n\n\u{1F99A} <b>' + (buyWallets.length - sellWallets.length) + ' smart holders</b>';
        
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "buy") {
                console.log("buybalance===", buyWallets[i].inAmount, solPrice, buyWallets[i].txTime)
                const amount = (buyWallets[i].inAmount / Math.pow(10, 9) * solPrice).toFixed(0);
                message = message + '\n\u{1F7E2} ' + buyWallets[i].name + '  ($' + amount + ') (' + buyWallets[i].txTime + ')';
            }
        }

        message = message + '\n\n\u{2757} <b>' + sellWallets.length + ' close</b>';
        
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "sell") {
                message = message + '\n\u{1F534} ' + buyWallets[i].name;
            }
        }

        message = message + '\n\n\u{26A1} <a href="https://jup.ag/swap/' + swapData.outMint + '-SOL">Jupiter</a>';
        message = message + '\n\u{1F438} <a href="https://gmgn.ai/sol/token/' + swapData.outMint + '">Gmgn</a>';
        message = message + '\n\u{1F680} <a href="https://photon-sol.tinyastro.io/en/lp/' + swapData.outMint + '">Photon</a>';
        message = message + '\n\u{1F402} <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=' + swapData.outMint + '">Bullx</a>';

        console.log('Preparing to send alerts...');
        await sendAlert('-1002359004329', message);
        await sendAlert('-1002444321759', message);
    } catch (error) {
        console.error('Error in checkDB_Alert:', error);
    }
}

const processSwapData = async (swap_data: any) => {
    try {
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
                    hour12: false,
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
                
                if (wallet_index < 0) {
                    buyPosition.wallets.push({
                        address: swap_data.owner, type: "buy", name: db_wallet.name, inAmount: swap_data.inAmount, txTime: buytxTime.toLocaleString('en-US', {
                            hour12: false,
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
                        hour12: false,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })
                }

                const buysInPosition_old: any = buyPosition.wallets.filter((wallet: any) => wallet.type === "buy")
                await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets, old: true })
                const buysInPosition: any = buyPosition.wallets.filter((wallet: any) => wallet.type === "buy")

                if (buysInPosition && buysInPosition.length >= 3 && buysInPosition_old?.length != buysInPosition.length) {
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data)
                }
                else if (buysInPosition.length < 3) {
                    // Cancella la posizione SOLO se scende sotto 3 wallet attivi
                    await database.removeTrackPosition({ token: swap_data.outMint })
                    openPosition = false
                }
                // Se >= 3 ma il numero non è cambiato, mantieni la posizione senza fare nulla
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

                    if (buycount >= 3 && buyWallets.length >= 3) {
                        console.log("status 2===== ", buyWallets.length);
                        await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false })
                        await checkDB_Alert(buyWallets, buyPosition?.old, swap_data)
                        break
                    }
                }
            }
        } else {
            if (swap_data.inMint === USDC_ADDRESS || swap_data.inMint === USDT_ADDRESS)
                return
            
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
                        
                        // Invia alert anche quando qualcuno vende
                        const buysInPosition: any = sellPosition.wallets.filter((wallet: any) => wallet.type === "buy")
                        if (buysInPosition.length >= 3) {
                            await checkDB_Alert(sellPosition.wallets, true, swap_data)
                        }
                    }
                }
            }

            await delayForTrxSync(swap_data.signature)
        }
    } catch (error) {
        console.error('Error in processSwapData:', error);
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
            if (count > 0) {
            }
        }
    } catch (error) {
        console.log("Transfer detection error", error)
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
        console.error('Error parsing transaction:', error);
    }
}

async function handleStream(client: Client, args: SubscribeRequest) {
    console.log('Stream connecting...');
    const stream = await client.subscribe();
    console.log('Stream connected');
    
    let lastDataTime = Date.now();
    
    const heartbeat = setInterval(() => {
        const timeSinceLastData = Date.now() - lastDataTime;
        console.log(`Stream alive - last data: ${Math.floor(timeSinceLastData / 1000)}s ago`);
        
        if (timeSinceLastData > 300000) {
            console.log('Stream seems dead, forcing reconnection...');
            clearInterval(heartbeat);
            stream.end();
        }
    }, 60000);

    const streamClosed = new Promise<void>((resolve, reject) => {
        stream.on("error", (error) => {
            console.log("Stream ERROR:", error);
            clearInterval(heartbeat);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            console.log("Stream ENDED");
            clearInterval(heartbeat);
            resolve();
        });
        stream.on("close", () => {
            console.log("Stream CLOSED");
            clearInterval(heartbeat);
            resolve();
        });
    });

    stream.on("data", (data) => {
        lastDataTime = Date.now();
        parseTransaction(data)
    });

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
    console.log('Initializing track-swap...');
    console.log('Telegram Bot Token:', process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN ? 'OK' : 'MISSING');
    console.log('GRPC Token:', process.env.GRPC_TOKEN ? 'OK' : 'MISSING');
    
    let detection_wallets: string[] = await getWallets()
    console.log('Tracking', detection_wallets.length, 'wallets');
    
    const req: SubscribeRequest = {
        accounts: {},
        slots: {},
        transactions: {
            subscribe_tx: {
                vote: false,
                failed: false,
                signature: undefined,
                accountInclude: detection_wallets,
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
