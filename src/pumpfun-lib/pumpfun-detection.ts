import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import { WSOL_ADDRESS } from "../uniconst";

export const PUMP_FUN_PROGRAM_ID = new PublicKey(
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
);

// Logger helper
const logDebug = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PUMPFUN] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};

export async function decodePumpfunTxn(tx: VersionedTransactionResponse) {
    try {
        logDebug("=== PUMPFUN DECODE START ===");
        
        if (!tx.meta || tx.meta?.err) {
            logDebug("❌ Transaction has no meta or has error");
            return null;
        }

        logDebug("✓ Transaction meta valid");

        // Get account keys
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        
        logDebug(`✓ Transaction signature: ${signature}`);
        logDebug(`✓ Account keys: ${accountKeys.length}`);

        // Owner is the fee payer (first account)
        const owner = accountKeys[0].toBase58();
        logDebug(`✓ Owner (fee payer): ${owner}`);

        // Check if transaction involves Pumpfun program
        const hasPumpFun = accountKeys.some((key: PublicKey) => 
            key.equals(PUMP_FUN_PROGRAM_ID)
        );

        if (!hasPumpFun) {
            logDebug("❌ No Pumpfun program in transaction");
            return null;
        }

        logDebug("✓ Pumpfun program confirmed");

        // Analyze token balances to determine swap direction
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        logDebug(`✓ Pre token balances: ${preBalances.length}`);
        logDebug(`✓ Post token balances: ${postBalances.length}`);

        // Find which tokens changed
        let tokenMint: string | null = null;
        let tokenAmount = 0;
        let solAmount = 0;
        let isBuy = false;

        // Compare balances to find token changes
        for (const postBalance of postBalances) {
            const preBalance = preBalances.find(
                (pre) => pre.accountIndex === postBalance.accountIndex
            );

            if (!preBalance) {
                // New token account = received tokens (BUY)
                if (postBalance.uiTokenAmount.uiAmount && postBalance.uiTokenAmount.uiAmount > 0) {
                    tokenMint = postBalance.mint;
                    tokenAmount = Math.floor(postBalance.uiTokenAmount.amount as any);
                    isBuy = true;
                    logDebug(`✓ BUY detected - received new token: ${tokenMint}`, {
                        amount: tokenAmount,
                        uiAmount: postBalance.uiTokenAmount.uiAmount,
                    });
                }
                continue;
            }

            const preAmount = parseFloat(preBalance.uiTokenAmount.amount as any);
            const postAmount = parseFloat(postBalance.uiTokenAmount.amount as any);
            const diff = postAmount - preAmount;

            if (diff < 0 && postBalance.mint !== WSOL_ADDRESS) {
                // Decreased non-SOL token = SELL
                tokenMint = postBalance.mint;
                tokenAmount = Math.abs(Math.floor(diff));
                isBuy = false;
                logDebug(`✓ SELL detected - token decreased: ${tokenMint}`, {
                    amount: tokenAmount,
                    preAmount: preAmount,
                    postAmount: postAmount,
                });
            } else if (diff > 0 && postBalance.mint !== WSOL_ADDRESS) {
                // Increased non-SOL token = BUY
                tokenMint = postBalance.mint;
                tokenAmount = Math.floor(diff);
                isBuy = true;
                logDebug(`✓ BUY detected - token increased: ${tokenMint}`, {
                    amount: tokenAmount,
                    preAmount: preAmount,
                    postAmount: postAmount,
                });
            }
        }

        // Handle SOL (native) transfers
        const preSolBalance = tx.meta.preBalances[0] || 0;
        const postSolBalance = tx.meta.postBalances[0] || 0;
        const solDiff = postSolBalance - preSolBalance;

        logDebug(`SOL balance change:`, {
            pre: preSolBalance,
            post: postSolBalance,
            diff: solDiff,
        });

        // Calculate SOL amount (accounting for fees)
        if (isBuy) {
            // BUY: SOL decreased
            solAmount = Math.abs(solDiff);
        } else {
            // SELL: SOL increased (minus fees)
            solAmount = Math.max(0, solDiff);
        }

        // Validate we found the token
        if (!tokenMint) {
            logDebug("❌ Could not determine token mint", {
                preBalances: preBalances.length,
                postBalances: postBalances.length,
            });
            return null;
        }

        // Create swap object
        const swap = {
            signature,
            owner,
            type: 'pump_fun',
            inMint: isBuy ? WSOL_ADDRESS : tokenMint,
            outMint: isBuy ? tokenMint : WSOL_ADDRESS,
            inAmount: isBuy ? solAmount : tokenAmount,
            outAmount: isBuy ? tokenAmount : solAmount,
        };

        logDebug("✅ PUMPFUN DECODE SUCCESS", swap);
        logDebug("=== PUMPFUN DECODE END ===");

        return swap;

    } catch (error) {
        logDebug("❌ EXCEPTION in Pumpfun decode", error);
        console.error("Pumpfun decode error:", error);
        return null;
    }
}
