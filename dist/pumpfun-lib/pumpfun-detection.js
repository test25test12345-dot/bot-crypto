"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUMP_FUN_PROGRAM_ID = void 0;
exports.decodePumpfunTxn = decodePumpfunTxn;
const web3_js_1 = require("@solana/web3.js");
const uniconst_1 = require("../uniconst");
exports.PUMP_FUN_PROGRAM_ID = new web3_js_1.PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const logDebug = (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PUMPFUN] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};
const formatAmount = (amount) => {
    return (amount / 1e9).toFixed(4) + " SOL";
};
function findTokenMint(tx) {
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    logDebug("🔍 Searching for token mint...");
    logDebug(`Pre-balances: ${preBalances.length}, Post-balances: ${postBalances.length}`);
    for (const balance of postBalances) {
        if (balance.mint && balance.mint !== uniconst_1.WSOL_ADDRESS) {
            logDebug(`✅ Strategy 1 - Found token in postBalances: ${balance.mint}`);
            return balance.mint;
        }
    }
    for (const balance of preBalances) {
        if (balance.mint && balance.mint !== uniconst_1.WSOL_ADDRESS) {
            logDebug(`✅ Strategy 2 - Found token in preBalances: ${balance.mint}`);
            return balance.mint;
        }
    }
    const accountKeys = tx.transaction.message.staticAccountKeys;
    for (let i = 0; i < accountKeys.length; i++) {
        const account = accountKeys[i].toBase58();
        if (account !== uniconst_1.WSOL_ADDRESS &&
            account !== "11111111111111111111111111111111" &&
            account !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" &&
            account !== "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" &&
            !account.startsWith("Sysvar") &&
            account !== exports.PUMP_FUN_PROGRAM_ID.toBase58()) {
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
function analyzeBalanceChanges(tx, tokenMint) {
    const preBalances = tx.meta?.preTokenBalances || [];
    const postBalances = tx.meta?.postTokenBalances || [];
    const preSolBalance = tx.meta?.preBalances[0] || 0;
    const postSolBalance = tx.meta?.postBalances[0] || 0;
    logDebug("💰 Analyzing balance changes...");
    let tokenAmount = 0;
    let isBuy = false;
    for (const postBalance of postBalances) {
        if (postBalance.mint !== tokenMint)
            continue;
        const preBalance = preBalances.find((pre) => pre.accountIndex === postBalance.accountIndex);
        if (!preBalance) {
            tokenAmount = Math.floor(parseFloat(postBalance.uiTokenAmount.amount));
            isBuy = true;
            logDebug(`✅ New token account detected (BUY): ${tokenAmount}`);
            break;
        }
        const preAmount = parseFloat(preBalance.uiTokenAmount.amount);
        const postAmount = parseFloat(postBalance.uiTokenAmount.amount);
        const diff = postAmount - preAmount;
        if (diff > 0) {
            tokenAmount = Math.floor(diff);
            isBuy = true;
            logDebug(`✅ Token increased (BUY): ${tokenAmount}`);
        }
        else if (diff < 0) {
            tokenAmount = Math.floor(Math.abs(diff));
            isBuy = false;
            logDebug(`✅ Token decreased (SELL): ${tokenAmount}`);
        }
        if (tokenAmount > 0)
            break;
    }
    if (tokenAmount === 0) {
        for (const preBalance of preBalances) {
            if (preBalance.mint !== tokenMint)
                continue;
            const postBalance = postBalances.find((post) => post.accountIndex === preBalance.accountIndex);
            if (!postBalance) {
                tokenAmount = Math.floor(parseFloat(preBalance.uiTokenAmount.amount));
                isBuy = false;
                logDebug(`✅ Token account closed (SELL): ${tokenAmount}`);
                break;
            }
        }
    }
    const solDiff = postSolBalance - preSolBalance;
    let solAmount = Math.abs(solDiff);
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
function validateSwap(swap) {
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
    if (swap.inMint !== uniconst_1.WSOL_ADDRESS && swap.outMint !== uniconst_1.WSOL_ADDRESS) {
        logDebug("⚠️ Warning: Neither inMint nor outMint is SOL", {
            inMint: swap.inMint,
            outMint: swap.outMint
        });
    }
    if (swap.inMint === uniconst_1.WSOL_ADDRESS) {
        logDebug(`✅ Detected BUY: ${formatAmount(swap.inAmount)} → ${swap.outMint.substring(0, 8)}...`);
    }
    else if (swap.outMint === uniconst_1.WSOL_ADDRESS) {
        logDebug(`✅ Detected SELL: ${swap.inMint.substring(0, 8)}... → ${formatAmount(swap.outAmount)}`);
    }
    logDebug("✅ Swap validation passed");
    return true;
}
async function decodePumpfunTxn(tx) {
    try {
        logDebug("=== PUMPFUN DECODE START ===");
        if (!tx.meta || tx.meta?.err) {
            logDebug("❌ Transaction has no meta or has error");
            return null;
        }
        logDebug("✅ Transaction meta valid");
        const accountKeys = tx.transaction.message.staticAccountKeys;
        const signature = tx.transaction.signatures[0];
        logDebug(`✅ Transaction signature: ${signature}`);
        logDebug(`✅ Account keys: ${accountKeys.length}`);
        const owner = accountKeys[0].toBase58();
        logDebug(`✅ Owner (fee payer): ${owner}`);
        const hasPumpFun = accountKeys.some((key) => key.equals(exports.PUMP_FUN_PROGRAM_ID));
        if (!hasPumpFun) {
            logDebug("❌ No Pumpfun program in transaction");
            return null;
        }
        logDebug("✅ Pumpfun program confirmed");
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
        const analysis = analyzeBalanceChanges(tx, tokenMint);
        if (!analysis) {
            logDebug("❌ Could not analyze balance changes");
            return null;
        }
        const swap = {
            signature,
            owner,
            type: 'pump_fun',
            inMint: analysis.isBuy ? uniconst_1.WSOL_ADDRESS : tokenMint,
            outMint: analysis.isBuy ? tokenMint : uniconst_1.WSOL_ADDRESS,
            inAmount: analysis.isBuy ? analysis.solAmount : analysis.tokenAmount,
            outAmount: analysis.isBuy ? analysis.tokenAmount : analysis.solAmount,
        };
        if (!validateSwap(swap)) {
            logDebug("❌ Swap validation failed");
            return null;
        }
        logDebug("✅ PUMPFUN DECODE SUCCESS", {
            type: analysis.isBuy ? 'BUY' : 'SELL',
            owner: owner.substring(0, 8) + "...",
            token: tokenMint.substring(0, 8) + "...",
            inAmount: swap.inMint === uniconst_1.WSOL_ADDRESS ? formatAmount(swap.inAmount) : swap.inAmount,
            outAmount: swap.outMint === uniconst_1.WSOL_ADDRESS ? formatAmount(swap.outAmount) : swap.outAmount
        });
        logDebug("=== PUMPFUN DECODE END ===");
        return swap;
    }
    catch (error) {
        logDebug("❌ EXCEPTION in Pumpfun decode", error);
        console.error("Pumpfun decode error:", error);
        return null;
    }
}
//# sourceMappingURL=pumpfun-detection.js.map