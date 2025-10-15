import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { WSOL_ADDRESS } from "../uniconst";

export const PUMP_FUN_PROGRAM_ID = new PublicKey(
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);

// Logger helper con timestamp più dettagliato
const logDebug = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PUMPFUN] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};

// Helper per formattare i numeri
const formatAmount = (amount: number) => {
    return (amount / 1e9).toFixed(4) + " SOL";
};

/**
 * Trova il token mint usando multiple strategie
 */
function findTokenMint(tx: VersionedTransactionResponse): string | null {
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    
    logDebug("🔍 Searching for token mint...");
    logDebug(`Pre-balances: ${preBalances.length}, Post-balances: ${postBalances.length}`);
    
    // Strategia 1: Cerca token nei postBalances che non sono SOL
    for (const balance of postBalances) {
        if (balance.mint && balance.mint !== WSOL_ADDRESS) {
            logDebug(`✅ Strategy 1 - Found token in postBalances: ${balance.mint}`);
            return balance.mint;
        }
    }
    
    // Strategia 2: Cerca token nei preBalances che non sono SOL
    for (const balance of preBalances) {
        if (balance.mint && balance.mint !== WSOL_ADDRESS) {
            logDebug(`✅ Strategy 2 - Found token in preBalances: ${balance.mint}`);
            return balance.mint;
        }
    }
    
    // Strategia 3: Cerca nelle istruzioni account che potrebbero essere il mint
    const accountKeys = tx.transaction.message.staticAccountKeys;
    for (let i = 0; i < accountKeys.length; i++) {
        const account = accountKeys[i].toBase58();
        // Escludiamo account comuni (system program, token program, etc)
        if (account !== WSOL_ADDRESS && 
            account !== "11111111111111111111111111111111" &&
            account !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" &&
            account !== "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" &&
            !account.startsWith("Sysvar") &&
            account !== PUMP_FUN_PROGRAM_ID.toBase58()) {
            
            // Verifica se questo account appare nei token balances
            const inBalances = preBalances.some(b => b.mint === account) || 
                              postBalances.some(b => b.mint === account);
            
            if (inBalances) {
                logDebug(`✅ Strategy 3 - Found token in account keys: ${account}`);
                return account;
            }
        }
    }
    
    logDebug("❌ Could not find token mint with any strategy");
    return null;
}

/**
 * Analizza i balance changes per determinare tipo di swap e amount
 */
interface SwapAnalysis {
    isBuy: boolean;
    tokenMint: string;
    tokenAmount: number;
    solAmount: number;
}

function analyzeBalanceChanges(tx: VersionedTransactionResponse, tokenMint: string): SwapAnalysis | null {
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    const preSolBalance = tx.meta?.preBalances[0] || 0;
    const postSolBalance = tx.meta?.postBalances[0] || 0;
    
    logDebug("💰 Analyzing balance changes...");
    
    let tokenAmount = 0;
    let isBuy = false;
    
    // Trova il cambiamento nel token balance
    for (const postBalance of postBalances) {
        if (postBalance.mint !== tokenMint) continue;
        
        const preBalance = preBalances.find(
            (pre) => pre.accountIndex === postBalance.accountIndex
        );
        
        if (!preBalance) {
            // Nuovo account = BUY
            tokenAmount = Math.floor(parseFloat(postBalance.uiTokenAmount.amount as any));
            isBuy = true;
            logDebug(`✅ New token account detected (BUY): ${tokenAmount}`);
            break;
        }
        
        const preAmount = parseFloat(preBalance.uiTokenAmount.amount as any);
        const postAmount = parseFloat(postBalance.uiTokenAmount.amount as any);
        const diff = postAmount - preAmount;
        
        if (diff > 0) {
            // Token aumentato = BUY
            tokenAmount = Math.floor(diff);
            isBuy = true;
            logDebug(`✅ Token increased (BUY): ${tokenAmount}`);
        } else if (diff < 0) {
            // Token diminuito = SELL
            tokenAmount = Math.floor(Math.abs(diff));
            isBuy = false;
            logDebug(`✅ Token decreased (SELL): ${tokenAmount}`);
        }
        
        if (tokenAmount > 0) break;
    }
    
    // Se non abbiamo trovato cambio nei token balances, proviamo con i preBalances
    if (tokenAmount === 0) {
        for (const preBalance of preBalances) {
            if (preBalance.mint !== tokenMint) continue;
            
            const postBalance = postBalances.find(
                (post) => post.accountIndex === preBalance.accountIndex
            );
            
            if (!postBalance) {
                // Account chiuso = probabilmente SELL completo
                tokenAmount = Math.floor(parseFloat(preBalance.uiTokenAmount.amount as any));
                isBuy = false;
                logDebug(`✅ Token account closed (SELL): ${tokenAmount}`);
                break;
            }
        }
    }
    
    // Calcola SOL amount
    const solDiff = postSolBalance - preSolBalance;
    let solAmount = Math.abs(solDiff);
    
    // Per i buy, il SOL dovrebbe diminuire
    // Per i sell, il SOL dovrebbe aumentare
    if (isBuy && solDiff > 0) {
        logDebug("⚠️ Warning: BUY detected but SOL increased - might be wrong direction");
    }
    if (!isBuy && solDiff < 0) {
        logDebug("⚠️ Warning: SELL detected but SOL decreased - might be wrong direction");
    }
    
    logDebug(`📊 Analysis result:`, {
        isBuy,
        tokenAmount,
        solAmount: formatAmount(solAmount),
        solDiff: formatAmount(solDiff)
    });
    
    if (tokenAmount === 0) {
        logDebug("❌ Could not determine token amount");
        return null;
    }
    
    return {
        isBuy,
        tokenMint,
        tokenAmount,
        solAmount
    };
}

/**
 * Valida che i dati dello swap siano sensati
 */
function validateSwap(swap: any): boolean {
    logDebug("🔍 Validating swap data...");
    
    if (!swap.owner) {
        logDebug("❌ Missing owner");
        return false;
    }
    
    if (!swap.inMint || !swap.outMint) {
        logDebug("❌ Missing mint addresses");
        return false;
    }
    
    if (swap.inAmount <= 0 || swap.outAmount <= 0) {
        logDebug("❌ Invalid amounts", { inAmount: swap.inAmount, outAmount: swap.outAmount });
        return false;
    }
    
    // Validazione: in una transazione, uno deve essere SOL
    if (swap.inMint !== WSOL_ADDRESS && swap.outMint !== WSOL_ADDRESS) {
        logDebug("⚠️ Warning: Neither inMint nor outMint is SOL", { 
            inMint: swap.inMint, 
            outMint: swap.outMint 
        });
    }
    
    // Per BUY: inMint dovrebbe essere SOL
    if (swap.inMint === WSOL_ADDRESS) {
        logDebug(`✅ Detected BUY: ${formatAmount(swap.inAmount)} → ${swap.outMint.substring(0, 8)}...`);
    }
    // Per SELL: outMint dovrebbe essere SOL
    else if (swap.outMint === WSOL_ADDRESS) {
        logDebug(`✅ Detected SELL: ${swap.inMint.substring(0, 8)}... → ${formatAmount(swap.outAmount)}`);
    }
    
    logDebug("✅ Swap validation passed");
    return true;
}

export async function decodePumpfunTxn(tx: VersionedTransactionResponse) {
    try {
        logDebug("=== PUMPFUN DECODE START ===");
        
        // Validazione base
        if (!tx.meta || tx.meta?.err) {
            logDebug("❌ Transaction has no meta or has error");
            return null;
        }

        logDebug("✅ Transaction meta valid");

        // Get account keys
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        
        logDebug(`✅ Transaction signature: ${signature}`);
        logDebug(`✅ Account keys: ${accountKeys.length}`);

        // Owner è il fee payer (primo account)
        const owner = accountKeys[0].toBase58();
        logDebug(`✅ Owner (fee payer): ${owner}`);

        // Verifica che la transazione coinvolga Pumpfun
        const hasPumpFun = accountKeys.some((key: PublicKey) => 
            key.equals(PUMP_FUN_PROGRAM_ID)
        );

        if (!hasPumpFun) {
            logDebug("❌ No Pumpfun program in transaction");
            return null;
        }

        logDebug("✅ Pumpfun program confirmed");

        // STEP 1: Trova il token mint
        const tokenMint = findTokenMint(tx);
        
        if (!tokenMint) {
            logDebug("❌ Could not find token mint");
            logDebug("Available mints in balances:", {
                pre: tx.meta.preTokenBalances?.map(b => b.mint),
                post: tx.meta.postTokenBalances?.map(b => b.mint)
            });
            return null;
        }
        
        logDebug(`✅ Token mint found: ${tokenMint}`);

        // STEP 2: Analizza i balance changes
        const analysis = analyzeBalanceChanges(tx, tokenMint);
        
        if (!analysis) {
            logDebug("❌ Could not analyze balance changes");
            return null;
        }

        // STEP 3: Costruisci l'oggetto swap
        const swap = {
            signature,
            owner,
            type: 'pump_fun',
            inMint: analysis.isBuy ? WSOL_ADDRESS : tokenMint,
            outMint: analysis.isBuy ? tokenMint : WSOL_ADDRESS,
            inAmount: analysis.isBuy ? analysis.solAmount : analysis.tokenAmount,
            outAmount: analysis.isBuy ? analysis.tokenAmount : analysis.solAmount,
        };

        // STEP 4: Valida lo swap
        if (!validateSwap(swap)) {
            logDebug("❌ Swap validation failed");
            return null;
        }

        logDebug("✅ PUMPFUN DECODE SUCCESS", {
            type: analysis.isBuy ? 'BUY' : 'SELL',
            owner: owner.substring(0, 8) + "...",
            token: tokenMint.substring(0, 8) + "...",
            inAmount: swap.inMint === WSOL_ADDRESS ? formatAmount(swap.inAmount) : swap.inAmount,
            outAmount: swap.outMint === WSOL_ADDRESS ? formatAmount(swap.outAmount) : swap.outAmount
        });
        
        logDebug("=== PUMPFUN DECODE END ===");

        return swap;

    } catch (error) {
        logDebug("❌ EXCEPTION in Pumpfun decode", error);
        console.error("Pumpfun decode error:", error);
        return null;
    }
}
