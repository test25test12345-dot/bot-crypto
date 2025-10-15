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
        logToFile('✅ Alert sent to: ' + chatId);
    } catch (error: any) {
        logToFile('❌ Failed to send to: ' + chatId + ' - ' + error.message);
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
        console.log(message);
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
        logToFile(`🚨 checkDB_Alert START - Token: ${swapData.outMint}`);
        logToFile(`   Total wallets: ${buyWallets.length}`);
        
        const sellWallets: any = await buyWallets.filter((wallet: any) => wallet.type === "sell")
        logToFile(`   Sell wallets: ${sellWallets.length}`);
        
        const tokenMCap: string = await getTokenMcap(swapData)
        logToFile(`   MCap: ${tokenMCap}`);
        
        const tokenInfo: any = await getTokenInfo(swapData)
        logToFile(`   Token name: ${tokenInfo.data?.name || 'N/A'}`);
        
        const solPrice: any = await getTokenPrice_(swapData.inMint)
        logToFile(`   SOL Price: ${solPrice}`);
        
        const extensions: any = tokenInfo.data?.extensions ?? null
        const positionTradeScore = await getTokenScore(buyWallets, swapData)
        logToFile(`   TradeScore: ${positionTradeScore}`);

        buyWallets.sort((a: any, b: any) => {
            if (a > b) {
                return -1;
            } else if (a < b) {
                return 1;
            }
            return 0;
        });

        let message = '';
        
        message = message + '\n💸 <b>New smart holder entry</b>\n';
        message = message + '\n🔎 <b>Address</b>: <code>' + swapData.outMint + '</code>';
        message = message + '\n💰 <b>Name</b>: ' + (tokenInfo.data?.name ?? " ");
        message = message + '\n📈 <b>MCap</b>: ' + tokenMCap;

        if (extensions && extensions.website) {
            message = message + '\n🔗 <a href="' + extensions.website + '">Website</a>';
        }
        if (extensions && extensions.twitter) {
            message = message + '\n🔗 <a href="' + extensions.twitter + '">Twitter</a>';
        }
        if (extensions && extensions.telegram) {
            message = message + '\n🔗 <a href="' + extensions.telegram + '">Telegram</a>';
        }
        if (extensions && extensions.discord) {
            message = message + '\n🔗 <a href="' + extensions.discord + '">Discord</a>';
        }

        message = message + '\n\n💯 <b>TradeScore</b>: ' + positionTradeScore;
        message = message + '\n\n🦚 <b>' + (buyWallets.length - sellWallets.length) + ' smart holders</b>';
        
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "buy") {
                const amount = (buyWallets[i].inAmount / Math.pow(10, 9) * solPrice).toFixed(0);
                message = message + '\n🟢 ' + buyWallets[i].name + '  ($' + amount + ') (' + buyWallets[i].txTime + ')';
            }
        }

        message = message + '\n\n❗ <b>' + sellWallets.length + ' close</b>';
        
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "sell") {
                message = message + '\n🔴 ' + buyWallets[i].name;
            }
        }

        message = message + '\n\n⚡ <a href="https://jup.ag/swap/' + swapData.outMint + '-SOL">Jupiter</a>';
        message = message + '\n🐸 <a href="https://gmgn.ai/sol/token/' + swapData.outMint + '">Gmgn</a>';
        message = message + '\n🚀 <a href="https://photon-sol.tinyastro.io/en/lp/' + swapData.outMint + '">Photon</a>';
        message = message + '\n🐂 <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=' + swapData.outMint + '">Bullx</a>';

        logToFile('📤 Preparing to send alerts...');
        
        await sendAlert(process.env.GROUP_CHATID || '', message);
        await sendAlert(process.env.GROUP_CHATID1 || '', message);
        await sendAlert(process.env.GROUP_CHATID2 || '', message);
        
        logToFile('✅ checkDB_Alert COMPLETE');
    } catch (error) {
        logToFile(`❌ ERROR in checkDB_Alert: ${error}`);
        console.error('❌ Error in checkDB_Alert:', error);
    }
}

const processSwapData = async (swap_data: any) => {
    try {
        logToFile("========================================");
        logToFile("📊 processSwapData CALLED");
        
        if (!swap_data) {
            logToFile("❌ swap_data is NULL - returning");
            return
        }
        
        logToFile(`✅ swap_data VALID`);
        logToFile(`   Owner: ${swap_data.owner}`);
        logToFile(`   Type: ${swap_data.type}`);
        logToFile(`   inMint: ${swap_data.inMint}`);
        logToFile(`   outMint: ${swap_data.outMint}`);
        logToFile(`   inAmount: ${swap_data.inAmount}`);
        logToFile(`   outAmount: ${swap_data.outAmount}`);
        logToFile(`   Signature: ${swap_data.signature}`);
        
        // FILTRO 0: Check se inMint e outMint sono uguali (swap invalido)
        if (swap_data.inMint === swap_data.outMint) {
            logToFile(`❌ INVALID SWAP - Same token: ${swap_data.inMint}`);
            return;
        }
        
        // FILTRO 1: Blacklist
        if (BLACKLISTED_WALLETS.includes(swap_data.owner)) {
            logToFile(`❌ BLACKLISTED - ${swap_data.owner}`);
            return;
        }
        
        // FILTRO 2: Whitelist
        const trackedWallet = wallets.find(w => w.address === swap_data.owner);
        if (!trackedWallet) {
            logToFile(`❌ NOT IN WHITELIST - ${swap_data.owner}`);
            return;
        }
        
        logToFile(`✅ WALLET OK: ${trackedWallet.name}`);

        let db_wallet: any = await database.selectTrackWallet({ wallet: swap_data.owner })
        if (!db_wallet) {
            logToFile("⚠️ Wallet NOT in DB - creating...");
            await database.updateTrackWallet({ 
                wallet: swap_data.owner, 
                tokens: [], 
                name: trackedWallet.name 
            });
            db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
            logToFile("✅ Wallet created in DB");
        } else {
            logToFile(`✅ Wallet found in DB: ${db_wallet.name}`);
        }
        
        if (swap_data.inMint === WSOL_ADDRESS) {
            // === BUY LOGIC ===
            
            // FILTRO 3: Skip se outMint è stablecoin
            if (swap_data.outMint === USDC_ADDRESS || swap_data.outMint === USDT_ADDRESS) {
                logToFile("⭕ Skip: buying stablecoin");
                return
            }
            
            logToFile(`💚 BUY DETECTED: ${trackedWallet.name} -> ${swap_data.outMint.substring(0,8)}...`);
            
            const buytxTime = new Date();

            let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.outMint)
            if (token_index < 0) {
                logToFile("➕ New token for this wallet");
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
                logToFile("🔄 Existing token - updating");
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
            logToFile("✅ Wallet updated in DB");

            const buyPosition: any = await database.selectTrackPosition({ token: swap_data.outMint })
            logToFile(`Position check: ${buyPosition ? "EXISTS" : "NEW"}`);

            let openPosition: Boolean = false
            if (buyPosition && buyPosition.token) {
                openPosition = true
                let wallet_index: any = buyPosition.wallets.findIndex((wallet: any) => wallet.address === swap_data.owner)
                
                const buysBefore = buyPosition.wallets.filter((w: any) => w.type === "buy").length;
                logToFile(`📊 Buyers BEFORE update: ${buysBefore}`);
                
                if (wallet_index < 0) {
                    logToFile("➕ Adding wallet to position");
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
                    logToFile("🔄 Updating wallet in position");
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

                await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyPosition.wallets, old: true })
                const buysAfter = buyPosition.wallets.filter((wallet: any) => wallet.type === "buy").length;

                logToFile(`📊 Buyers AFTER update: ${buysAfter}`);

                // INVIO ALERT se >= 3 buyer E il numero è aumentato
                if (buysAfter >= 3 && buysAfter > buysBefore) {
                    logToFile(`🚨🚨🚨 ALERT TRIGGER: ${buysAfter} buyers (was ${buysBefore})!`);
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data)
                }
                else if (buysAfter < 3) {
                    logToFile(`⭕ Less than 3 buyers (${buysAfter}), removing position`);
                    await database.removeTrackPosition({ token: swap_data.outMint })
                    openPosition = false
                } else {
                    logToFile(`⭕ No new buyer (before=${buysBefore}, after=${buysAfter})`);
                }
            }

            if (!openPosition) {
                logToFile("🔍 No open position - checking all wallets...");
                let buycount = 0
                let buyWallets: any = []
                const trackWallets: any = await database.selectTrackWallets({})
                logToFile(`📊 Checking ${trackWallets.length} total wallets in DB`);
                
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
                            logToFile(`  ✓ ${wallet.name} has this token`);
                        }
                    }
                }

                logToFile(`📊 Found ${buycount} wallets with this token`);

                if (buycount >= 3 && buyWallets.length >= 3) {
                    logToFile(`🚨🚨🚨 NEW POSITION ALERT: ${buyWallets.length} buyers!`);
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false })
                    await checkDB_Alert(buyWallets, false, swap_data)
                } else {
                    logToFile(`⭕ Only ${buycount} wallets, need 3 for alert`);
                }
            }
        } else {
            // === SELL LOGIC ===
            
            // FILTRO 4: Skip se inMint è stablecoin
            if (swap_data.inMint === USDC_ADDRESS || swap_data.inMint === USDT_ADDRESS) {
                logToFile("⭕ Skip: selling to stablecoin");
                return
            }
            
            logToFile(`🔴 SELL DETECTED: ${trackedWallet.name} -> ${swap_data.inMint.substring(0,8)}...`);
            
            let solPrice: any = await getTokenPrice_(WSOL_ADDRESS)

            let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.inMint)
            let sellAvailable = false;

            if (token_index >= 0) {
                // Check if rimane meno di $60 dopo la sell
                if ((Number(db_wallet.tokens[token_index].inAmount) - Number(swap_data.outAmount)) / 10 ** 9 * solPrice < 60) {
                    db_wallet.tokens[token_index].type = "sell"
                    db_wallet.tokens[token_index].inAmount = Number(db_wallet.tokens[token_index].inAmount) - Number(swap_data.inAmount)
                    if (Number(db_wallet.tokens[token_index].inAmount) < 0) db_wallet.tokens[token_index].inAmount = 0
                    await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name })
                    sellAvailable = true
                    logToFile("✅ Sell registered (position < $60)");
                } else {
                    logToFile("⭕ Partial sell - position still > $60");
                }
            } else {
                logToFile("⚠️ Token not found in wallet for sell");
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
                        } else {
                            logToFile(`⭕ Position now has only ${buysInPosition.length} buyers - no alert`);
                        }
                    }
                }
            }

            await delayForTrxSync(swap_data.signature)
        }
        
        logToFile("========================================");
    } catch (error) {
        logToFile(`❌ ERROR in processSwapData: ${error}`);
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
            
            const involvedAccounts = accountKeys.map((key: PublicKey) => key.toBase58());
            
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
                        logToFile(`✅ Jupiter decode OK - proceeding to processSwapData`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ Jupiter decode returned NULL");
                    }
                } catch (error) {
                    logToFile(`❌ Jupiter decode ERROR: ${error}`);
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
                        logToFile(`✅ Raydium CPMM decode OK - proceeding to processSwapData`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ Raydium CPMM decode returned NULL");
                    }
                } catch (error) {
                    logToFile(`❌ Raydium CPMM decode ERROR: ${error}`);
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
                        logToFile(`✅ Raydium decode OK - proceeding to processSwapData`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ Raydium decode returned NULL");
                    }
                } catch (error) {
                    logToFile(`❌ Raydium decode ERROR: ${error}`);
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
                        logToFile(`✅ PumpFun decode OK - proceeding to processSwapData`);
                        await processSwapData(ret)
                    } else {
                        logToFile("❌ PumpFun decode returned NULL");
                    }
                } catch (error) {
                    logToFile(`❌ PumpFun decode ERROR: ${error}`);
                }
                return
            }
            
            if (ourWallets.length > 0) {
                logToFile("⚠️ Transaction from our wallet but NO DEX detected");
                logToFile(`  First 5 programs: ${accountKeys.slice(0,5).map(k => k.toBase58().substring(0,8) + "...").join(', ')}`);
            }
        }
    } catch (error) {
        logToFile(`❌ ERROR parsing transaction: ${error}`);
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
        logToFile(`💓 Stream alive - last data: ${Math.floor(timeSinceLastData / 1000)}s ago, processed: ${transactionCount} txs`);
        
        if (timeSinceLastData > 300000) {
            logToFile('⚠️ Stream dead - forcing reconnection...');
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
    logToFile(`Telegram Bot Token: ${process.env.ALERTS_BOT_TOKEN || process.env.BOT_TOKEN ? '✓' : '✗'}`);
    logToFile(`GRPC Token: ${process.env.GRPC_TOKEN ? '✓' : '✗'}`);
    logToFile('GRPC Endpoint: https://grpc.eu.shyft.to');
    
    let detection_wallets: string[] = await getWallets()
    logToFile(`📊 Total wallets to track: ${detection_wallets.length}`);
    
    const testWallets = [
        'prED5Hv9jaZmKRw7NcENdUMu6Pw2NWBmN2DSAEbNP7Y',
        'pp2rgZ8Bshvc1XHCerHJH77fNA7AGQND8D9zfW2AeVb',
        '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf'
    ];
    
    for (let wallet of testWallets) {
        if (detection_wallets.includes(wallet)) {
            logToFile(`✓ ${wallet.substring(0,8)}... is in tracking list`);
        } else {
            logToFile(`✗ ${wallet.substring(0,8)}... NOT in tracking list`);
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
