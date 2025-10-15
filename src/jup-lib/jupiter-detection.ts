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

export async function getJupiterSwapInfo(tx: VersionedTransactionResponse) {
    try {
        logDebug("=== JUPITER DECODE START ===");
        
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

        // Log instruction details
        jupiterIxs.forEach((ix, index) => {
            logDebug(`Instruction ${index}:`, {
                name: (ix as any).name,
                programId: ix.programId.toBase58(),
                accounts: (ix as any).accounts?.length || 0,
            });
        });

        // Get account keys
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        
        logDebug(`✓ Transaction signature: ${signature}`);
        logDebug(`✓ Account keys: ${accountKeys.length}`);

        // Owner is the fee payer (first account)
        const owner = accountKeys[0].toBase58();
        logDebug(`✓ Owner (fee payer): ${owner}`);

        // Analyze token balances to determine swap direction
        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        logDebug(`✓ Pre token balances: ${preBalances.length}`);
        logDebug(`✓ Post token balances: ${postBalances.length}`);

        // Find which tokens changed
        let inMint: string | null = null;
        let outMint: string | null = null;
        let inAmount = 0;
        let outAmount = 0;

        // Compare balances to find input/output tokens
        for (const postBalance of postBalances) {
            const preBalance = preBalances.find(
                (pre) => pre.accountIndex === postBalance.accountIndex
            );

            if (!preBalance) {
                // New token account = received tokens (output)
                if (postBalance.uiTokenAmount.uiAmount && postBalance.uiTokenAmount.uiAmount > 0) {
                    outMint = postBalance.mint;
                    outAmount = Math.floor(postBalance.uiTokenAmount.amount as any);
                    logDebug(`✓ Output token found: ${outMint}`, {
                        amount: outAmount,
                        uiAmount: postBalance.uiTokenAmount.uiAmount,
                    });
                }
                continue;
            }

            const preAmount = parseFloat(preBalance.uiTokenAmount.amount as any);
            const postAmount = parseFloat(postBalance.uiTokenAmount.amount as any);
            const diff = postAmount - preAmount;

            if (diff < 0) {
                // Decreased = sent tokens (input)
                inMint = postBalance.mint;
                inAmount = Math.abs(Math.floor(diff));
                logDebug(`✓ Input token found: ${inMint}`, {
                    amount: inAmount,
                    preAmount: preAmount,
                    postAmount: postAmount,
                });
            } else if (diff > 0) {
                // Increased = received tokens (output)
                outMint = postBalance.mint;
                outAmount = Math.floor(diff);
                logDebug(`✓ Output token found: ${outMint}`, {
                    amount: outAmount,
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

        // If SOL decreased significantly (more than fees), it's the input
        if (solDiff < -100000) { // More than 0.0001 SOL
            inMint = WSOL_ADDRESS;
            inAmount = Math.abs(solDiff);
            logDebug(`✓ SOL is input token: ${inAmount} lamports`);
        }
        // If SOL increased, it's the output
        else if (solDiff > 100000) {
            outMint = WSOL_ADDRESS;
            outAmount = solDiff;
            logDebug(`✓ SOL is output token: ${outAmount} lamports`);
        }

        // Validate we found both tokens
        if (!inMint || !outMint) {
            logDebug("❌ Could not determine input/output tokens", {
                inMint,
                outMint,
                inAmount,
                outAmount,
            });
            return null;
        }

        // Create swap object
        const swap = {
            signature,
            owner,
            type: 'jupiter',
            inMint,
            outMint,
            inAmount,
            outAmount,
        };

        logDebug("✅ JUPITER DECODE SUCCESS", swap);
        logDebug("=== JUPITER DECODE END ===");

        return swap;

    } catch (error) {
        logDebug("❌ EXCEPTION in Jupiter decode", error);
        console.error("Jupiter decode error:", error);
        return null;
    }
}
