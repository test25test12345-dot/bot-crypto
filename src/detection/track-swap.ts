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
import path from 'path';
import fs from 'fs';
import TelegramBot from 'node-telegram-bot-api'

const alertBot = new TelegramBot(process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN || '', {polling: false});

// Lista nera di wallet da ignorare
const BLACKLISTED_WALLETS = [
    '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'
];

const sendAlert = async (chatId: string, message: string) => {
    try {
        const utf8Message = Buffer.from(message, 'utf8').toString('utf8');
        await alertBot.sendMessage(chatId, utf8Message, { 
            parse_mode: 'HTML', 
            disable_web_page_preview: true 
        });
        console.log('✅ Alert sent to:', chatId);
    } catch (error: any) {
        console.error('❌ Failed to send to:', chatId, error.message);
    }
};

const logToFile = (message: string) => {
    try {
        const logDir = path.join(__dirname, 'logs');
        const logFilePath = path.join(logDir, 'track-debug.log');
        
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        
        fs.appendFileSync(logFilePath, logMessage, 'utf8');
        console.log(message); // Log anche su console
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
        logToFile(`🚨 checkDB_Alert chiamato con ${buyWallets.length} wallet`);
        logToFile(`Token: ${swapData.outMint}`);
        
        const sellWallets: any = await buyWallets.filter((wallet: any) => wallet.type === "sell")
        const tokenMCap: string = await getTokenMcap(swapData)
        const tokenInfo: any = await getTokenInfo(swapData)
        const solPrice: any = await getTokenPrice_(swapData.inMint)
        logToFile(`SOL Price: ${solPrice}, MCap: ${tokenMCap}`);
        
        const extensions: any = tokenInfo.data?.extensions ?? null
        const positionTradeScore = await getTokenScore(buyWallets, swapData)
        logToFile(`TradeScore: ${positionTradeScore}`);

        buyWallets.sort((a: any, b: any) => {
            if (a > b) {
                return -1;
            } else if (a < b) {
                return 1;
            }
            return 0;
        });

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

        logToFile('📤 Preparing to send alerts...');
        
        await sendAlert('-1002359004329', message);
        await sendAlert('-1002444321759', message);
        
        logToFile('✅ Alerts sent successfully');
    } catch (error) {
        logToFile(`❌ Error in checkDB_Alert: ${error}`);
        console.error('❌ Error in checkDB_Alert:', error);
    }
}

const processSwapData = async (swap_data: any) => {
    try {
        if (!swap_data) {
            logToFile("❌ processSwapData called with null data");
            return
        }
        
        logToFile("====== SWAP DATA RECEIVED ======");
        logToFile(`Owner: ${swap_data.owner}`);
        logToFile(`Type: ${swap_data.type}`);
        logToFile(`inMint: ${swap_data.inMint}`);
        logToFile(`outMint: ${swap_data.outMint}`);
        logToFile(`inAmount: ${swap_data.inAmount}`);
        logToFile(`outAmount: ${swap_data.outAmount}`);
        logToFile(`Signature: ${swap_data.signature}`);
        logToFile("================================");
        
        // FILTRO 1: Blacklist esplicita
        if (BLACKLISTED_WALLETS.includes(swap_data.owner)) {
            logToFile(`❌ BLACKLISTED WALLET - IGNORED: ${swap_data.owner}`);
            return;
        }
        
        // FILTRO 2: Whitelist - deve essere nella lista
        const trackedWallet = wallets.find(w => w.address === swap_data.owner);
        if (!trackedWallet) {
            logToFile(`❌ NOT IN WHITELIST - IGNORED: ${swap_data.owner}`);
            return;
        }
        
        logToFile(`✅ VALID WALLET: ${trackedWallet.name} (${swap_data.owner.substring(0,8)}...)`);

        let db_wallet: any = await database.selectTrackWallet({ wallet: swap_data.owner })
        if (!db_wallet) {
            logToFile("⚠️ Wallet non trovato nel database, creazione in corso...");
            await database.updateTrackWallet({ 
                wallet: swap_data.owner, 
                tokens: [], 
                name: trackedWallet.name 
            });
            db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
            logToFile("✅ Wallet creato nel database");
        }
        
        if (swap_data.inMint === WSOL_ADDRESS) {
            // BUY logic
            if (swap_data.outMint === USDC_ADDRESS || swap_data.outMint === USDT_ADDRESS) {
                logToFile("⏭️ Skip: stablecoin swap");
                return
            }
            
            logToFile(`💚 BUY: ${trackedWallet.name} sta comprando ${swap_data.outMint.substring(0,8)}...`);
            
            const buytxTime = new Date();

            let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.outMint)
            if (token_index < 0) {
                logToFile("➕ Nuovo token per questo wallet");
                db_wallet.tokens.push({
                    mint: swap_data.outMint, 
                    type: "buy", 
                    txTime: buytxTime.toLocaleString('en-US', {
                        hour12: false,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }), 
                    inAmount: swap_data.inAmount
                })
            } else {
                logToFile("🔄 Token già esistente, aggiornamento");
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
            logToFile("✅ Database wallet aggiornato");

            const buyPosition: any = await database.selectTrackPosition({ token: swap_data.outMint })
            logToFile(`Position esistente per ${swap_data.outMint.substring(0,8)}...? ${buyPosition ? "SI" : "NO"}`);

            let openPosition: Boolean = false
            if (buyPosition && buyPosition.token) {
                openPosition = true
                let wallet_index: any = buyPosition.wallets.findIndex((wallet: any) => wallet.address === swap_data.owner)
                
                if (wallet_index < 0) {
                    logToFile("➕ Aggiunta wallet alla posizione");
                    buyPosition.wallets.push({
                        address: swap_data.owner, 
                        type: "buy", 
                        name: db_wallet.name, 
                        inAmount: swap_data.inAmount, 
                        txTime: buytxTime.toLocaleString('en-US', {
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
                    logToFile("🔄 Aggiornamento wallet nella posizione");
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

                logToFile(`📊 Buyers: OLD=${buysInPosition_old.length} NEW=${buysInPosition.length}`);

                if (buysInPosition && buysInPosition.length >= 3 && buysInPosition_old?.length != buysInPosition.length) {
                    logToFile(`🚨🚨🚨 ALERT TRIGGERED: ${buysInPosition.length} wallet hanno comprato ${swap_data.outMint}`);
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data)
                }
                else if (buysInPosition.length < 3) {
                    logToFile(`⏭️ Meno di 3 buyer (${buysInPosition.length}), rimuovo posizione`);
                    await database.removeTrackPosition({ token: swap_data.outMint })
                    openPosition = false
                } else {
                    logToFile(`⏭️ Alert già inviato (old=${buysInPosition_old.length}, new=${buysInPosition.length})`);
                }
            }

            if (!openPosition) {
                logToFile("🔍 Nessuna posizione aperta, controllo tutti i wallet...");
                let buycount = 0
                let buyWallets: any = []
                const trackWallets: any = await database.selectTrackWallets({})
                logToFile(`📊 Controllo ${trackWallets.length} wallet totali nel database`);
                
                for (const wallet of trackWallets) {
                    for (const token of wallet.tokens) {
                        if (token.mint === swap_data.outMint && token.type === "buy") {
                            buycount++
                            buyWallets.push({ 
                                address: wallet.wallet, 
                                type: "buy", 
                                name: wallet.name, 
                                inAmount: token.inAmount, 
                                txTime: token.txTime 
                            })
                            logToFile(`  ✓ ${wallet.name} ha ${swap_data.outMint.substring(0,8)}...`);
                        }
                    }
                }

                logToFile(`📊 Trovati ${buycount} wallet con questo token`);

                if (buycount >= 3 && buyWallets.length >= 3) {
                    logToFile(`🚨🚨🚨 NEW POSITION ALERT: ${buyWallets.length} wallet hanno comprato ${swap_data.outMint}`);
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false })
                    await checkDB_Alert(buyWallets, false, swap_data)
                } else {
                    logToFile(`⏭️ Solo ${buycount} wallet hanno questo token, serve almeno 3 per alert`);
                }
            }
        } else {
            // SELL logic
            if (swap_data.inMint === USDC_ADDRESS || swap_data.inMint === USDT_ADDRESS) {
                logToFile("⏭️ Skip: stablecoin sell");
                return
            }
            
            logToFile(`🔴 SELL: ${trackedWallet.name} sta vendendo token ${swap_data.inMint.substring(0,8)}...`);
            
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
                    logToFile("✅ Sell registrato");
                }
            } else {
                logToFile("⚠️ Token non trovato nel wallet per sell");
            }

            if (sellAvailable) {
                const sellPosition: any = await database.selectTrackPosition({ token: swap_data.inMint })
                if (sellPosition) {
                    let wallet_index: any = sellPosition.wallets.findIndex((wallet: any) => wallet.address === swap_data.owner)
                    if (wallet_index >= 0) {
                        sellPosition.wallets[wallet_index].type = "sell"
                        await database.updateTrackPosition({ token: swap_data.inMint, wallets: sellPosition.wallets, old: true })
                        
                        const buysInPosition: any = sellPosition.wallets.filter((wallet: any) => wallet.type === "buy")
                        if (buysInPosition.length >= 3) {
                            logToFile("🚨 SELL ALERT");
                            await checkDB_Alert(sellPosition.wallets, true, swap_data)
                        }
                    }
                }
            }

            await delayForTrxSync(swap_data.signature)
        }
    } catch (error) {
        logToFile(`❌ Error in processSwapData: ${error}`);
        console.error('❌ Error in processSwapData:', error);
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
            const signature = txn.transaction.signatures[0];
            
            // Log TUTTI gli account coinvolti nella transazione
            const involvedAccounts = accountKeys.map((key: PublicKey) => key.toBase58());
            
            // Verifica quali dei nostri wallet sono coinvolti
            const ourWallets = involvedAccounts.filter((acc: string) => 
                wallets.some(w => w.address === acc)
            );
            
            if (ourWallets.length > 0) {
                logToFile(`✓ TRANSACTION WITH OUR WALLET: ${signature}`);
                logToFile(`  Our wallets involved: ${ourWallets.join(', ')}`);
            }
            
            // Jupiter
            const hasJupiter = accountKeys.find((programId: PublicKey) => programId.equals(JUPITER_V6_PROGRAM_ID))
            if (hasJupiter) {
                logToFile("🟢 Jupiter transaction detected");
                try {
                    const ret = await getJupiterSwapInfo(txn)
                    if (ret) {
                        logToFile(`✅ Jupiter swap decoded successfully`);
                        logToFile(`   Owner: ${ret.owner}`);
                        logToFile(`   Type: ${ret.type}`);
                        logToFile(`   inMint: ${ret.inMint}`);
                        logToFile(`   outMint: ${ret.outMint}`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ Jupiter swap decode returned null");
                    }
                } catch (error) {
                    logToFile(`❌ Jupiter decode error: ${error}`);
                }
                return
            }
            
            // Raydium CPMM
            const hasCpmm = accountKeys.find((programId: PublicKey) => 
                programId.equals(new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"))
            )
            if (hasCpmm) {
                logToFile("🟢 Raydium CPMM transaction detected");
                try {
                    const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
                    const ret = await decodeRaydiumCpmmTxn(txn)
                    if (ret) {
                        logToFile(`✅ Raydium CPMM swap decoded successfully`);
                        logToFile(`   Owner: ${ret.owner}`);
                        logToFile(`   Type: ${ret.type}`);
                        logToFile(`   inMint: ${ret.inMint}`);
                        logToFile(`   outMint: ${ret.outMint}`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ Raydium CPMM swap decode returned null");
                    }
                } catch (error) {
                    logToFile(`❌ Raydium CPMM decode error: ${error}`);
                }
                return
            }

            // Raydium
            const hasRaydium = accountKeys.find((programId: PublicKey) => programId.equals(RayLiqPoolv4))
            if (hasRaydium) {
                logToFile("🟢 Raydium transaction detected");
                try {
                    const txn = TXN_FORMATTER.formTransactionFromJson(data.transaction, Date.now());
                    const ret = await decodeRaydiumTxn(txn)
                    if (ret) {
                        logToFile(`✅ Raydium swap decoded successfully`);
                        logToFile(`   Owner: ${ret.owner}`);
                        logToFile(`   Type: ${ret.type}`);
                        logToFile(`   inMint: ${ret.inMint}`);
                        logToFile(`   outMint: ${ret.outMint}`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ Raydium swap decode returned null");
                    }
                } catch (error) {
                    logToFile(`❌ Raydium decode error: ${error}`);
                }
                return
            }
            
            // PumpFun
            const hasPumpFun = accountKeys.find((programId: PublicKey) => programId.equals(PUMP_FUN_PROGRAM_ID))
            if (hasPumpFun) {
                logToFile("🟢 PumpFun transaction detected");
                try {
                    const ret = await decodePumpfunTxn(txn)
                    if (ret) {
                        logToFile(`✅ PumpFun swap decoded successfully`);
                        logToFile(`   Owner: ${ret.owner}`);
                        logToFile(`   Type: ${ret.type}`);
                        logToFile(`   inMint: ${ret.inMint}`);
                        logToFile(`   outMint: ${ret.outMint}`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ PumpFun swap decode returned null");
                    }
                } catch (error) {
                    logToFile(`❌ PumpFun decode error: ${error}`);
                }
                return
            }
            
            // Se nessun DEX è stato rilevato ma è una transazione dei nostri wallet
            if (ourWallets.length > 0) {
                logToFile("⚠️ Transaction from our wallet but NO DEX detected");
                logToFile(`  First 5 programs in transaction: ${accountKeys.slice(0,5).map(k => k.toBase58().substring(0,8) + "...").join(', ')}`);
            }
        }
    } catch (error) {
        logToFile(`❌ Error parsing transaction: ${error}`);
        console.error('❌ Error parsing transaction:', error);
    }
}

async function handleStream(client: Client, args: SubscribeRequest) {
    logToFile('🌐 Stream connecting...');
    const stream = await client.subscribe();
    logToFile('✅ Stream connected successfully');
    
    let lastDataTime = Date.now();
    let transactionCount = 0;
    
    const heartbeat = setInterval(() => {
        const timeSinceLastData = Date.now() - lastDataTime;
        logToFile(`💓 Stream alive - last data: ${Math.floor(timeSinceLastData / 1000)}s ago, processed: ${transactionCount} transactions`);
        
        if (timeSinceLastData > 300000) {
            logToFile('⚠️ Stream seems dead, forcing reconnection...');
            clearInterval(heartbeat);
            stream.end();
        }
    }, 60000);

    const streamClosed = new Promise<void>((resolve, reject) => {
        stream.on("error", (error) => {
            logToFile(`❌ Stream ERROR: ${error}`);
            clearInterval(heartbeat);
            reject(error);
            stream.end();
        });
        stream.on("end", () => {
            logToFile("🔴 Stream ENDED");
            clearInterval(heartbeat);
            resolve();
        });
        stream.on("close", () => {
            logToFile("🔴 Stream CLOSED");
            clearInterval(heartbeat);
            resolve();
        });
    });

    stream.on("data", (data) => {
        lastDataTime = Date.now();
        transactionCount++;
        if (transactionCount % 50 === 0) {
            logToFile(`📊 Processed ${transactionCount} transactions`);
        }
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
        logToFile(`❌ Stream write error: ${reason}`);
        throw reason;
    });

    await streamClosed;
}

async function subscribeCommand(client: Client, args: SubscribeRequest) {
    while (true) {
        try {
            logToFile("🚀 Starting Substream server...")
            await handleStream(client, args);
        } catch (error) {
            logToFile(`❌ Stream error, restarting in 1 second... Error: ${error}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

const client = new Client('https://grpc.eu.shyft.to', process.env.GRPC_TOKEN, undefined);

export const start = async () => {
    logToFile("================================");
    logToFile('🚀 TRACK-SWAP INITIALIZATION');
    logToFile("================================");
    logToFile(`Telegram Bot Token: ${process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN ? '✔' : '✗'}`);
    logToFile(`GRPC Token: ${process.env.GRPC_TOKEN ? '✔' : '✗'}`);
    logToFile('GRPC Endpoint: https://grpc.eu.shyft.to');
    
    let detection_wallets: string[] = await getWallets()
    logToFile(`📊 Total wallets to track: ${detection_wallets.length}`);
    
    // Verifica specifici wallet
    const testWallets = [
        'prED5Hv9jaZmKRw7NcENdUMu6Pw2NWBmN2DSAEbNP7Y', // pooh1
        'pp2rgZ8Bshvc1XHCerHJH77fNA7AGQND8D9zfW2AeVb', // pooh2
        '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf' // wallet problematico
    ];
    
    for (let wallet of testWallets) {
        if (detection_wallets.includes(wallet)) {
            logToFile(`✔ ${wallet.substring(0,8)}... è nella lista di tracking`);
        } else {
            logToFile(`✗ ${wallet.substring(0,8)}... NON è nella lista di tracking`);
        }
    }
    
    logToFile("================================");
    logToFile("🌐 Starting gRPC stream subscription...");
    
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
    
    logToFile(`📡 Subscription request created with ${detection_wallets.length} wallets`);
    subscribeCommand(client, req);
}
