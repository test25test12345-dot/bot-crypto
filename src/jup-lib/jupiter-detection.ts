import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { TransactionFormatter } from "../detection/transaction-formatter";
import { JUPITER_V6_PROGRAM_ID } from "./constant";
import { WSOL_ADDRESS } from "../uniconst";

const TXN_FORMATTER = new TransactionFormatter();
const JUPITER_IX_PARSER = new SolanaParser([]);

// Logger helper
const logDebug = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [JUPITER] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};

interface TokenChange {
    mint: string;
    netChange: number;
    preAmount: number;
    postAmount: number;
}

/**
 * Analizza i cambiamenti nei token balances
 */
function analyzeTokenBalances(tx: VersionedTransactionResponse): TokenChange[] {
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    
    const tokenChanges = new Map<string, TokenChange>();
    
    // Analizza tutti i post balances
    for (const postBalance of postBalances) {
        const mint = postBalance.mint;
        const postAmount = parseFloat(postBalance.uiTokenAmount.amount as any) || 0;
        
        // Trova il corrispondente pre balance
        const preBalance = preBalances.find(
            (pre) => pre.accountIndex === postBalance.accountIndex
        );
        const preAmount = preBalance ? (parseFloat(preBalance.uiTokenAmount.amount as any) || 0) : 0;
        
        // Calcola il cambio netto
        const netChange = postAmount - preAmount;
        
        if (!tokenChanges.has(mint)) {
            tokenChanges.set(mint, {
                mint,
                netChange: 0,
                preAmount: 0,
                postAmount: 0
            });
        }
        
        const existing = tokenChanges.get(mint)!;
        existing.netChange += netChange;
        existing.preAmount += preAmount;
        existing.postAmount += postAmount;
    }
    
    // Analizza i pre balances che potrebbero non avere corrispondenti post balances (account chiusi)
    for (const preBalance of preBalances) {
        const mint = preBalance.mint;
        const hasPost = postBalances.some(
            (post) => post.accountIndex === preBalance.accountIndex
        );
        
        if (!hasPost) {
            const preAmount = parseFloat(preBalance.uiTokenAmount.amount as any) || 0;
            
            if (!tokenChanges.has(mint)) {
                tokenChanges.set(mint, {
                    mint,
                    netChange: 0,
                    preAmount: 0,
                    postAmount: 0
                });
            }
            
            const existing = tokenChanges.get(mint)!;
            existing.netChange -= preAmount;
            existing.preAmount += preAmount;
        }
    }
    
    return Array.from(tokenChanges.values());
}

/**
 * Identifica input e output tokens dallo swap
 */
function identifySwapTokens(
    tokenChanges: TokenChange[],
    nativeSOLChange: number
): { inMint: string | null; outMint: string | null; inAmount: number; outAmount: number } {
    
    logDebug("🔍 Identifying swap tokens...");
    
    // Filtra solo i cambiamenti significativi (> 1000 units per evitare dust)
    const significantChanges = tokenChanges.filter(tc => Math.abs(tc.netChange) > 1000);
    
    logDebug("Significant token changes:", significantChanges.map(tc => ({
        mint: tc.mint.substring(0, 8) + "...",
        netChange: tc.netChange,
        direction: tc.netChange > 0 ? "IN" : "OUT"
    })));
    
    // Trova token con il maggior aumento (output)
    let outputToken = significantChanges
        .filter(tc => tc.netChange > 0)
        .sort((a, b) => b.netChange - a.netChange)[0];
    
    // Trova token con il maggior decremento (input)
    let inputToken = significantChanges
        .filter(tc => tc.netChange < 0)
        .sort((a, b) => a.netChange - b.netChange)[0];
    
    let inMint: string | null = null;
    let outMint: string | null = null;
    let inAmount = 0;
    let outAmount = 0;
    
    // CASO 1: Token → Token (entrambi trovati e nessuno è WSOL)
    if (inputToken && outputToken && inputToken.mint !== WSOL_ADDRESS && outputToken.mint !== WSOL_ADDRESS) {
        logDebug("✅ Case 1: Token → Token swap");
        inMint = inputToken.mint;
        outMint = outputToken.mint;
        inAmount = Math.abs(Math.floor(inputToken.netChange));
        outAmount = Math.floor(outputToken.netChange);
        
        logDebug("Result:", { inMint: inMint.substring(0,8) + "...", outMint: outMint.substring(0,8) + "...", inAmount, outAmount });
        return { inMint, outMint, inAmount, outAmount };
    }
    
    // CASO 2: SOL → Token (WSOL decreased OR native SOL decreased, token increased)
    if (outputToken && outputToken.mint !== WSOL_ADDRESS) {
        const wrappedSOLChange = tokenChanges.find(tc => tc.mint === WSOL_ADDRESS)?.netChange || 0;
        
        // Se wrapped SOL è diminuito O native SOL è diminuito (più delle fee ~0.01 SOL)
        if (wrappedSOLChange < -1000000 || nativeSOLChange < -10000000) {
            logDebug("✅ Case 2: SOL → Token swap (BUY)");
            inMint = WSOL_ADDRESS;
            outMint = outputToken.mint;
            
            // Amount: usa il wrapped SOL se disponibile, altrimenti native SOL
            if (wrappedSOLChange < -1000000) {
                inAmount = Math.abs(Math.floor(wrappedSOLChange));
            } else {
                inAmount = Math.abs(nativeSOLChange);
            }
            outAmount = Math.floor(outputToken.netChange);
            
            logDebug("Result:", { inMint: "SOL", outMint: outMint.substring(0,8) + "...", inAmount, outAmount });
            return { inMint, outMint, inAmount, outAmount };
        }
    }
    
    // CASO 3: Token → SOL (token decreased, WSOL increased OR native SOL increased)
    if (inputToken && inputToken.mint !== WSOL_ADDRESS) {
        const wrappedSOLChange = tokenChanges.find(tc => tc.mint === WSOL_ADDRESS)?.netChange || 0;
        
        // Se wrapped SOL è aumentato O native SOL è aumentato (più delle fee)
        if (wrappedSOLChange > 1000000 || nativeSOLChange > 10000000) {
            logDebug("✅ Case 3: Token → SOL swap (SELL)");
            inMint = inputToken.mint;
            outMint = WSOL_ADDRESS;
            inAmount = Math.abs(Math.floor(inputToken.netChange));
            
            // Amount: usa il wrapped SOL se disponibile, altrimenti native SOL
            if (wrappedSOLChange > 1000000) {
                outAmount = Math.floor(wrappedSOLChange);
            } else {
                outAmount = Math.abs(nativeSOLChange);
            }
            
            logDebug("Result:", { inMint: inMint.substring(0,8) + "...", outMint: "SOL", inAmount, outAmount });
            return { inMint, outMint, inAmount, outAmount };
        }
    }
    
    // CASO 4: Solo wrapped SOL coinvolto (raro, potrebbe essere wrap/unwrap)
    const wrappedSOLChange = tokenChanges.find(tc => tc.mint === WSOL_ADDRESS)?.netChange || 0;
    if (Math.abs(wrappedSOLChange) > 1000000 && Math.abs(nativeSOLChange) > 10000000) {
        // Se wrapped SOL diminuisce e native aumenta, probabilmente è solo unwrap
        if (wrappedSOLChange < 0 && nativeSOLChange > 0) {
            logDebug("⚠️ Case 4: Detected unwrap operation (not a swap)");
            return { inMint: null, outMint: null, inAmount: 0, outAmount: 0 };
        }
        
        // Se native diminuisce e wrapped aumenta, probabilmente è solo wrap
        if (nativeSOLChange < 0 && wrappedSOLChange > 0) {
            logDebug("⚠️ Case 4: Detected wrap operation (not a swap)");
            return { inMint: null, outMint: null, inAmount: 0, outAmount: 0 };
        }
    }
    
    // CASO 5: Fallback - usa qualsiasi cambiamento trovato
    if (inputToken || outputToken) {
        logDebug("⚠️ Case 5: Fallback detection");
        
        if (inputToken && !outputToken) {
            // Solo input trovato, assumiamo output sia SOL
            inMint = inputToken.mint;
            outMint = WSOL_ADDRESS;
            inAmount = Math.abs(Math.floor(inputToken.netChange));
            outAmount = Math.abs(nativeSOLChange);
        } else if (outputToken && !inputToken) {
            // Solo output trovato, assumiamo input sia SOL
            inMint = WSOL_ADDRESS;
            outMint = outputToken.mint;
            inAmount = Math.abs(nativeSOLChange);
            outAmount = Math.floor(outputToken.netChange);
        } else if (inputToken && outputToken) {
            // Entrambi trovati ma uno potrebbe essere WSOL
            inMint = inputToken.mint;
            outMint = outputToken.mint;
            inAmount = Math.abs(Math.floor(inputToken.netChange));
            outAmount = Math.floor(outputToken.netChange);
        }
        
        logDebug("Result:", { 
            inMint: inMint?.substring(0,8) + "...", 
            outMint: outMint?.substring(0,8) + "...", 
            inAmount, 
            outAmount 
        });
        return { inMint, outMint, inAmount, outAmount };
    }
    
    logDebug("❌ Could not identify swap tokens");
    return { inMint: null, outMint: null, inAmount: 0, outAmount: 0 };
}

/**
 * Valida che lo swap sia sensato
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
    
    if (swap.inMint === swap.outMint) {
        logDebug("❌ Invalid swap: input and output are the same token", {
            mint: swap.inMint,
            inAmount: swap.inAmount,
            outAmount: swap.outAmount
        });
        return false;
    }
    
    if (swap.inAmount <= 0 || swap.outAmount <= 0) {
        logDebug("❌ Invalid amounts", { 
            inAmount: swap.inAmount, 
            outAmount: swap.outAmount 
        });
        return false;
    }
    
    // Validazione: almeno uno deve essere SOL (per la maggior parte degli swap)
    // Ma permettiamo anche swap token-to-token
    const involvesSol = swap.inMint === WSOL_ADDRESS || swap.outMint === WSOL_ADDRESS;
    
    if (swap.inMint === WSOL_ADDRESS) {
        logDebug(`✅ Detected BUY: ${(swap.inAmount / 1e9).toFixed(4)} SOL → ${swap.outMint.substring(0, 8)}...`);
    } else if (swap.outMint === WSOL_ADDRESS) {
        logDebug(`✅ Detected SELL: ${swap.inMint.substring(0, 8)}... → ${(swap.outAmount / 1e9).toFixed(4)} SOL`);
    } else {
        logDebug(`✅ Detected Token→Token: ${swap.inMint.substring(0, 8)}... → ${swap.outMint.substring(0, 8)}...`);
    }
    
    logDebug("✅ Swap validation passed");
    return true;
}

export async function getJupiterSwapInfo(tx: VersionedTransactionResponse) {
    try {
        logDebug("=== JUPITER DECODE START ===");
        
        // Validazione base
        if (!tx.meta || tx.meta?.err) {
            logDebug("❌ Transaction has no meta or has error");
            return null;
        }

        logDebug("✓ Transaction meta valid");

        // Parse instructions
        const parsedIxs = JUPITER_IX_PARSER.parseTransactionWithInnerInstructions(tx);
        logDebug(`✓ Parsed ${parsedIxs.length} instructions`);

        // Filter Jupiter instructions
        const jupiterIxs = parsedIxs.filter((ix) =>
            ix.programId.equals(JUPITER_V6_PROGRAM_ID)
        );

        logDebug(`✓ Found ${jupiterIxs.length} Jupiter instructions`);

        if (jupiterIxs.length === 0) {
            logDebug("❌ No Jupiter instructions found");
            return null;
        }

        // Get account keys
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        
        logDebug(`✓ Transaction signature: ${signature}`);
        logDebug(`✓ Account keys: ${accountKeys.length}`);

        // Owner è il fee payer (primo account)
        const owner = accountKeys[0].toBase58();
        logDebug(`✓ Owner (fee payer): ${owner}`);

        // Analizza i token balances
        const tokenChanges = analyzeTokenBalances(tx);
        logDebug("Token changes calculated:", tokenChanges.map(tc => ({
            mint: tc.mint.substring(0, 8) + "...",
            netChange: tc.netChange,
            preAmount: tc.preAmount,
            postAmount: tc.postAmount
        })));

        // Analizza native SOL balance
        const preSolBalance = tx.meta.preBalances[0] || 0;
        const postSolBalance = tx.meta.postBalances[0] || 0;
        const nativeSOLChange = postSolBalance - preSolBalance;

        logDebug("Native SOL balance change:", {
            pre: preSolBalance,
            post: postSolBalance,
            netChange: nativeSOLChange,
            netChangeInSOL: (nativeSOLChange / 1e9).toFixed(6) + " SOL"
        });

        // Identifica input e output
        const { inMint, outMint, inAmount, outAmount } = identifySwapTokens(
            tokenChanges,
            nativeSOLChange
        );

        if (!inMint || !outMint) {
            logDebug("❌ Could not identify swap tokens");
            return null;
        }

        // Crea oggetto swap
        const swap = {
            signature,
            owner,
            type: 'jupiter',
            inMint,
            outMint,
            inAmount,
            outAmount,
        };

        // Valida lo swap
        if (!validateSwap(swap)) {
            logDebug("❌ Swap validation failed");
            return null;
        }

        logDebug("✅ JUPITER DECODE SUCCESS", {
            owner: owner.substring(0, 8) + "...",
            inMint: inMint.substring(0, 8) + "...",
            outMint: outMint.substring(0, 8) + "...",
            inAmount: inMint === WSOL_ADDRESS ? (inAmount / 1e9).toFixed(4) + " SOL" : inAmount,
            outAmount: outMint === WSOL_ADDRESS ? (outAmount / 1e9).toFixed(4) + " SOL" : outAmount
        });
        
        logDebug("=== JUPITER DECODE END ===");

        return swap;

    } catch (error) {
        logDebug("❌ EXCEPTION in Jupiter decode", error);
        console.error("Jupiter decode error:", error);
        return null;
    }
}
