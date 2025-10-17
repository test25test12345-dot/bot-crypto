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

// SOGLIA PER ALERT - Portata a 3 come richiesto
const ALERT_THRESHOLD = 3;

// Costante per conversione lamports
const LAMPORTS_TO_SOL = 1000000000; // 10^9

// Wallet specifici da monitorare con log extra
const DEBUG_WALLETS = {
    'Assassin.eth': '6LChaYRYtEYjLEHhzo4HdEmgNwu2aia8CM8VhR9wn6n7',
    'Doc': 'DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt',
    'GigaBrain': '3h65MmPZksoKKyEpEjnWU2Yk2iYT5oZDNitGy5cTaxoE',
    'Gake': 'DNfuF1L62WWyW3pqQwTxk8nKdX4CNnz5DKEFmnXvT4jK',
    '1': '4t9bWuZsXXKGMgmd96nFD4KWxyPNTsPm4q9jEMH4jD2i',
    'LetterBomb': 'BtMBMPkoNbnLF9Xn552guQq528KKXcsNBNNBre3oaQtr'
};

// Statistiche per debugging
let dexStats = {
    jupiter: 0,
    raydium: 0,
    pumpfun: 0,
    cpmm: 0,
    universal: 0,
    unknown: 0,
    total: 0,
    ourWalletTxs: 0,
    swapsProcessed: 0,
    missedSwaps: 0
};

// Helper per convertire lamports in SOL
const lamportsToSol = (lamports: number) => lamports / LAMPORTS_TO_SOL;

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

// Funzione helper per trovare i nostri wallet in una transazione
function findOurWalletsInTransaction(accountKeys: PublicKey[]): {address: string, wallet: any, position: number}[] {
    const results = [];
    const accounts = accountKeys.map(k => k.toBase58());
    
    for (let i = 0; i < accounts.length; i++) {
        const wallet = wallets.find(w => w.address === accounts[i]);
        if (wallet) {
            results.push({
                address: accounts[i],
                wallet: wallet,
                position: i
            });
        }
    }
    
    return results;
}

// Decoder universale POTENZIATO con correzione conversione SOL
async function decodeUniversalSwap(tx: VersionedTransactionResponse): Promise<any[]> {
    const swaps = [];
    
    try {
        if (!tx.meta || tx.meta?.err) return swaps;
        
        const accountKeys = tx.version === 0 ? 
            tx.transaction.message.staticAccountKeys : 
            (tx.transaction.message as Message).accountKeys;
        
        // Trova TUTTI i nostri wallet nella transazione
        const ourWallets = findOurWalletsInTransaction(accountKeys);
        if (ourWallets.length === 0) {
            return swaps;
        }
        
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];
        
        // Per ogni nostro wallet, cerca cambiamenti
        for (const ourWallet of ourWallets) {
            const owner = ourWallet.address;
            const walletInfo = ourWallet.wallet;
            
            const debugName = Object.keys(DEBUG_WALLETS).find(name => 
                DEBUG_WALLETS[name as keyof typeof DEBUG_WALLETS] === owner
            );
            
            // Metodo 1: Analizza token balance diretti
            const tokenChanges: any[] = [];
            
            // Cerca nei balance POST per account che appartengono al nostro wallet
            for (const post of postBalances) {
                const isOurAccount = post.owner === owner || 
                    (post.accountIndex < accountKeys.length && accountKeys[post.accountIndex].toBase58() === owner);
                
                if (!isOurAccount) continue;
                
                const pre = preBalances.find(p => 
                    p.accountIndex === post.accountIndex && 
                    p.mint === post.mint
                );
                
                if (pre) {
                    const change = Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount);
                    if (Math.abs(change) > 0) {
                        tokenChanges.push({
                            mint: post.mint,
                            change: change,
                            isIncrease: change > 0,
                            decimals: post.uiTokenAmount.decimals
                        });
                    }
                } else if (Number(post.uiTokenAmount.amount) > 0) {
                    // Nuovo token
                    tokenChanges.push({
                        mint: post.mint,
                        change: Number(post.uiTokenAmount.amount),
                        isIncrease: true,
                        decimals: post.uiTokenAmount.decimals
                    });
                }
            }
            
            // Check per token che erano in pre ma non in post (vendita completa)
            for (const pre of preBalances) {
                const isOurAccount = pre.owner === owner || 
                    (pre.accountIndex < accountKeys.length && accountKeys[pre.accountIndex].toBase58() === owner);
                
                if (!isOurAccount) continue;
                
                const post = postBalances.find(p => 
                    p.accountIndex === pre.accountIndex && 
                    p.mint === pre.mint
                );
                
                if (!post && Number(pre.uiTokenAmount.amount) > 0) {
                    tokenChanges.push({
                        mint: pre.mint,
                        change: -Number(pre.uiTokenAmount.amount),
                        isIncrease: false,
                        decimals: pre.uiTokenAmount.decimals
                    });
                }
            }
            
            // Check SOL change (in lamports)
            let solChange = 0;
            if (ourWallet.position < tx.meta.postBalances.length && 
                ourWallet.position < tx.meta.preBalances.length) {
                solChange = tx.meta.postBalances[ourWallet.position] - tx.meta.preBalances[ourWallet.position];
                
                // Se è il fee payer, aggiungi le fee
                if (ourWallet.position === 0) {
                    solChange += (tx.meta.fee || 0);
                }
            }
            
            // Log dettagliato per debug wallet (con conversione corretta)
            if (debugName && (tokenChanges.length > 0 || Math.abs(solChange) > 100000)) {
                logToFile(`   🔍 ${debugName} Universal Analysis:`);
                logToFile(`      Token changes: ${tokenChanges.length}`);
                logToFile(`      SOL change: ${lamportsToSol(solChange).toFixed(4)} SOL`);
                for (const tc of tokenChanges) {
                    logToFile(`      Token: ${tc.mint.substring(0,8)}... ${tc.isIncrease ? '+' : ''}${tc.change}`);
                }
            }
            
            // Detecta swap pattern - SOGLIE ABBASSATE
            if (tokenChanges.length === 1 && Math.abs(solChange) > 10000) { // Abbassato a 0.00001 SOL
                const token = tokenChanges[0];
                
                // Skip wrapped SOL
                if (token.mint === WSOL_ADDRESS || token.mint === "So11111111111111111111111111111111111111112") {
                    continue;
                }
                
                if (token.isIncrease && solChange < 0) {
                    // BUY
                    logToFile(`   ✅ Universal: ${walletInfo.name} BUY detected`);
                    swaps.push({
                        signature: tx.transaction.signatures[0],
                        owner: owner,
                        type: 'universal',
                        inMint: WSOL_ADDRESS,
                        outMint: token.mint,
                        inAmount: Math.abs(solChange), // In lamports
                        outAmount: Math.abs(token.change)
                    });
                } else if (!token.isIncrease && solChange > 0) {
                    // SELL
                    logToFile(`   ✅ Universal: ${walletInfo.name} SELL detected`);
                    swaps.push({
                        signature: tx.transaction.signatures[0],
                        owner: owner,
                        type: 'universal',
                        inMint: token.mint,
                        outMint: WSOL_ADDRESS,
                        inAmount: Math.abs(token.change),
                        outAmount: Math.abs(solChange) // In lamports
                    });
                }
            } else if (tokenChanges.length === 2) {
                // Token to token swap
                const token1 = tokenChanges[0];
                const token2 = tokenChanges[1];
                
                if (token1.isIncrease !== token2.isIncrease) {
                    const buyToken = token1.isIncrease ? token1 : token2;
                    const sellToken = token1.isIncrease ? token2 : token1;
                    
                    logToFile(`   ✅ Universal: ${walletInfo.name} TOKEN-TOKEN swap detected`);
                    swaps.push({
                        signature: tx.transaction.signatures[0],
                        owner: owner,
                        type: 'universal',
                        inMint: sellToken.mint,
                        outMint: buyToken.mint,
                        inAmount: Math.abs(sellToken.change),
                        outAmount: Math.abs(buyToken.change)
                    });
                }
            }
        }
        
        return swaps;
    } catch (error) {
        logToFile(`❌ Universal decoder error: ${error}`);
        return swaps;
    }
}

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
        
        const solPrice: any = await getTokenPrice_(WSOL_ADDRESS)
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

        message = message + '\n\n💯 <b>TradeScore</b>: ' + positionTradeScore;
        message = message + '\n\n🦚 <b>' + (buyWallets.length - sellWallets.length) + ' smart holders</b>';
        
        // CORREZIONE QUI: Conversione corretta da lamports a SOL per il calcolo USD
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "buy") {
                // Conversione da lamports a SOL prima di calcolare USD
                const solAmount = buyWallets[i].inAmount / LAMPORTS_TO_SOL;
                const usdAmount = solPrice ? (solAmount * solPrice).toFixed(0) : "N/A";
                message = message + '\n🟢 ' + buyWallets[i].name + '  ($' + usdAmount + ') (' + buyWallets[i].txTime + ')';
                
                // Log per debug
                logToFile(`   Wallet ${buyWallets[i].name}: ${buyWallets[i].inAmount} lamports = ${solAmount.toFixed(4)} SOL = $${usdAmount}`);
            }
        }

        message = message + '\n\n◉ <b>' + sellWallets.length + ' close</b>';
        
        for (let i = 0; i < buyWallets.length; i++) {
            if (buyWallets[i].type === "sell") {
                message = message + '\n🔴 ' + buyWallets[i].name;
            }
        }

        message = message + '\n\n⚡ <a href="https://jup.ag/swap/' + swapData.outMint + '-SOL">Jupiter</a>';
        message = message + '\n🸸 <a href="https://gmgn.ai/sol/token/' + swapData.outMint + '">Gmgn</a>';
        message = message + '\n🚀 <a href="https://photon-sol.tinyastro.io/en/lp/' + swapData.outMint + '">Photon</a>';
        message = message + '\n🐂 <a href="https://neo.bullx.io/terminal?chainId=1399811149&address=' + swapData.outMint + '">Bullx</a>';

        logToFile('📤 Preparing to send alerts...');
        
        await sendAlert(process.env.GROUP_CHATID || '', message);
        await sendAlert(process.env.GROUP_CHATID1 || '', message);
        await sendAlert(process.env.GROUP_CHATID2 || '', message);
        
        logToFile('✅ checkDB_Alert COMPLETE');
    } catch (error) {
        logToFile(`❌ ERROR in checkDB_Alert: ${error}`);
    }
}

const processSwapData = async (swap_data: any) => {
    try {
        if (!swap_data) return;
        
        // RIMOSSA la validazione degli importi troppo alti
        // Ora accetta TUTTI gli swap
        
        if (swap_data.inMint === swap_data.outMint) return;
        if (BLACKLISTED_WALLETS.includes(swap_data.owner)) return;
        
        const trackedWallet = wallets.find(w => w.address === swap_data.owner);
        if (!trackedWallet) return;
        
        // Log per debug wallet (con conversione corretta per SOL)
        const debugName = Object.keys(DEBUG_WALLETS).find(name => 
            DEBUG_WALLETS[name as keyof typeof DEBUG_WALLETS] === swap_data.owner
        );
        
        if (debugName) {
            const solAmount = swap_data.inMint === WSOL_ADDRESS 
                ? lamportsToSol(swap_data.inAmount) 
                : lamportsToSol(swap_data.outAmount);
            logToFile(`📊 SWAP by ${trackedWallet.name}: ${swap_data.inMint === WSOL_ADDRESS ? 'BUY' : 'SELL'} ${solAmount.toFixed(4)} SOL`);
        }
        
        dexStats.swapsProcessed++;

        let db_wallet: any = await database.selectTrackWallet({ wallet: swap_data.owner })
        if (!db_wallet) {
            await database.updateTrackWallet({ 
                wallet: swap_data.owner, 
                tokens: [], 
                name: trackedWallet.name 
            });
            db_wallet = await database.selectTrackWallet({ wallet: swap_data.owner });
        }
        
        if (swap_data.inMint === WSOL_ADDRESS) {
            // BUY
            if (swap_data.outMint === USDC_ADDRESS || swap_data.outMint === USDT_ADDRESS) return;
            
            const buytxTime = new Date();
            let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.outMint)
            
            if (token_index < 0) {
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
            let openPosition = false
            
            if (buyPosition && buyPosition.token) {
                openPosition = true
                let wallet_index: any = buyPosition.wallets.findIndex((wallet: any) => wallet.address === swap_data.owner)
                const buysBefore = buyPosition.wallets.filter((w: any) => w.type === "buy").length;
                
                if (wallet_index < 0) {
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
                } else {
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

                if (buysAfter >= ALERT_THRESHOLD && buysAfter > buysBefore) {
                    logToFile(`🚨 ALERT: ${buysAfter} buyers for ${swap_data.outMint.substring(0,8)}...`);
                    await checkDB_Alert(buyPosition.wallets, buyPosition?.old, swap_data)
                } else if (buysAfter < ALERT_THRESHOLD) {
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
                            buyWallets.push({ 
                                address: wallet.wallet, 
                                type: "buy", 
                                name: wallet.name, 
                                inAmount: token.inAmount, 
                                txTime: token.txTime 
                            })
                        }
                    }
                }

                if (buycount >= ALERT_THRESHOLD) {
                    logToFile(`🚨 NEW ALERT: ${buycount} buyers for ${swap_data.outMint.substring(0,8)}...`);
                    await database.updateTrackPosition({ token: swap_data.outMint, wallets: buyWallets, old: false })
                    await checkDB_Alert(buyWallets, false, swap_data)
                }
            }
        } else {
            // SELL
            if (swap_data.inMint === USDC_ADDRESS || swap_data.inMint === USDT_ADDRESS) return;

            let token_index = db_wallet.tokens.findIndex((mint: any) => mint.mint === swap_data.inMint)
            if (token_index >= 0) {
                db_wallet.tokens[token_index].type = "sell"
                db_wallet.tokens[token_index].inAmount = 0
                await database.updateTrackWallet({ wallet: swap_data.owner, tokens: db_wallet.tokens, name: db_wallet.name })

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
    } catch (error) {
        logToFile(`❌ ERROR in processSwapData: ${error}`);
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
            
            dexStats.total++;
            
            // Trova TUTTI i nostri wallet
            const ourWallets = findOurWalletsInTransaction(accountKeys);
            if (ourWallets.length === 0) return;
            
            dexStats.ourWalletTxs++;
            
            // Log dettagliato per debug wallet
            for (const w of ourWallets) {
                const debugName = Object.keys(DEBUG_WALLETS).find(name => 
                    DEBUG_WALLETS[name as keyof typeof DEBUG_WALLETS] === w.address
                );
                if (debugName) {
                    logToFile(`🔍 ${debugName} in tx ${signature.substring(0,8)}... at position ${w.position}`);
                }
            }
            
            const allSwaps = [];
            
            // ESEGUI SEMPRE I DECODER SE CI SONO NOSTRI WALLET
            // Jupiter
            if (accountKeys.some((k: PublicKey) => k.equals(JUPITER_V6_PROGRAM_ID))) {
                dexStats.jupiter++;
                try {
                    const ret = await getJupiterSwapInfo(txn);
                    if (ret && wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ Jupiter swap detected for ${ret.owner.substring(0,8)}...`);
                        allSwaps.push(ret);
                    }
                } catch (error) {
                    logToFile(`❌ Jupiter decode error: ${error}`);
                }
            }
            
            // PumpFun
            if (accountKeys.some((k: PublicKey) => k.equals(PUMP_FUN_PROGRAM_ID))) {
                dexStats.pumpfun++;
                try {
                    const ret = await decodePumpfunTxn(txn);
                    if (ret && wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ PumpFun swap detected for ${ret.owner.substring(0,8)}...`);
                        allSwaps.push(ret);
                    }
                } catch (error) {
                    logToFile(`❌ PumpFun decode error: ${error}`);
                }
            }
            
            // Raydium CPMM
            if (accountKeys.some((k: PublicKey) => k.toBase58() === "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C")) {
                dexStats.cpmm++;
                try {
                    const ret = await decodeRaydiumCpmmTxn(txn);
                    if (ret && wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ Raydium CPMM swap detected for ${ret.owner.substring(0,8)}...`);
                        allSwaps.push(ret);
                    }
                } catch (error) {
                    logToFile(`❌ CPMM decode error: ${error}`);
                }
            }
            
            // Raydium
            if (accountKeys.some((k: PublicKey) => k.equals(RayLiqPoolv4))) {
                dexStats.raydium++;
                try {
                    const ret = await decodeRaydiumTxn(txn);
                    if (ret && wallets.find(w => w.address === ret.owner)) {
                        logToFile(`✅ Raydium swap detected for ${ret.owner.substring(0,8)}...`);
                        allSwaps.push(ret);
                    }
                } catch (error) {
                    logToFile(`❌ Raydium decode error: ${error}`);
                }
            }
            
            // SEMPRE usa decoder universale per catturare swap non standard
            try {
                const universalSwaps = await decodeUniversalSwap(txn);
                if (universalSwaps.length > 0) {
                    dexStats.universal += universalSwaps.length;
                    for (const swap of universalSwaps) {
                        // Evita duplicati
                        const isDuplicate = allSwaps.some(s => 
                            s.owner === swap.owner && 
                            Math.abs(s.inAmount - swap.inAmount) < 1000
                        );
                        if (!isDuplicate) {
                            logToFile(`✅ Universal swap detected for ${swap.owner.substring(0,8)}...`);
                            allSwaps.push(swap);
                        }
                    }
                }
            } catch (error) {
                logToFile(`❌ Universal decode error: ${error}`);
            }
            
            // Processa tutti gli swap trovati
            if (allSwaps.length > 0) {
                logToFile(`🔄 Processing ${allSwaps.length} swap(s)`);
                for (const swap of allSwaps) {
                    await processSwapData(swap);
                }
            } else if (ourWallets.length > 0) {
                // Log se abbiamo wallet ma nessuno swap
                const hasAnyDex = accountKeys.some((k: PublicKey) => 
                    k.equals(JUPITER_V6_PROGRAM_ID) || 
                    k.equals(PUMP_FUN_PROGRAM_ID) || 
                    k.equals(RayLiqPoolv4) ||
                    k.toBase58() === "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
                );
                
                if (hasAnyDex) {
                    for (const w of ourWallets) {
                        const debugName = Object.keys(DEBUG_WALLETS).find(name => 
                            DEBUG_WALLETS[name as keyof typeof DEBUG_WALLETS] === w.address
                        );
                        if (debugName) {
                            logToFile(`   ⚠️ POSSIBLE MISSED SWAP for ${debugName} - DEX detected but no swap decoded`);
                        }
                    }
                    dexStats.missedSwaps++;
                }
            }

            // Stats ogni 100 tx
            if (dexStats.total % 100 === 0) {
                logToFile(`📊 STATS: Txs=${dexStats.total} OurWallet=${dexStats.ourWalletTxs} Swaps=${dexStats.swapsProcessed} Missed=${dexStats.missedSwaps}`);
                logToFile(`   DEX breakdown: Jup=${dexStats.jupiter} Pump=${dexStats.pumpfun} Ray=${dexStats.raydium} CPMM=${dexStats.cpmm} Universal=${dexStats.universal}`);
            }
        }
    } catch (error) {
        logToFile(`❌ ERROR parsing transaction: ${error}`);
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
        logToFile(`💗 Stream: ${Math.floor(timeSinceLastData/1000)}s | Txs: ${transactionCount} | Our: ${dexStats.ourWalletTxs} | Swaps: ${dexStats.swapsProcessed}`);
        
        if (timeSinceLastData > 300000) {
            logToFile('⚠️ Stream dead - reconnecting...');
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
            logToFile("🚀 Starting stream...");
            logToFile(`📊 Alert threshold: ${ALERT_THRESHOLD} wallet(s)`);
            logToFile("🔍 Universal decoder: ENHANCED with SOL conversion fix");
            logToFile("✅ All DEX decoders: ACTIVE for all tracked wallets");
            await handleStream(client, args);
        } catch (error) {
            logToFile(`❌ Stream error, restarting... ${error}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

const client = new Client('https://grpc.eu.shyft.to', process.env.GRPC_TOKEN, undefined);

export const start = async () => {
    logToFile("================================");
    logToFile('🚀 TRACK-SWAP V5.1 - FIXED USD VALUES');
    logToFile("================================");
    logToFile(`Alert threshold: ${ALERT_THRESHOLD} wallet(s)`);
    logToFile('✅ Decoders active for ALL tracked wallets');
    logToFile('✅ No amount limits on swaps');
    logToFile('✅ Enhanced universal decoder with proper SOL conversion');
    logToFile('✅ SOL values now properly converted from lamports');
    logToFile('✅ USD values now calculated correctly');
    
    let detection_wallets: string[] = await getWallets()
    logToFile(`📊 Tracking ${detection_wallets.length} wallets`);
    
    // Verifica debug wallets
    for (const [name, address] of Object.entries(DEBUG_WALLETS)) {
        if (detection_wallets.includes(address)) {
            logToFile(`✅ ${name} is tracked`);
        }
    }
    
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
