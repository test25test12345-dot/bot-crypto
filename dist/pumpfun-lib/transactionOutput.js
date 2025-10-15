"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionOutput = transactionOutput;
function transactionOutput(txn) {
    try {
        if (!txn || !txn.instructions || txn.instructions.length === 0) {
            console.error('Invalid transaction structure:', txn);
            return null;
        }
        const instruction = txn.instructions[0];
        if (!instruction || !instruction.name || !instruction.accounts || !instruction.args) {
            console.error('Invalid instruction structure:', instruction);
            return null;
        }
        const type = instruction.name === "sell" ? "SELL" : "BUY";
        const mintAccount = instruction.accounts.find((item) => item?.name === 'mint');
        if (!mintAccount || !mintAccount.pubkey) {
            console.error('Mint account not found or invalid:', instruction.accounts);
            return null;
        }
        const mint = mintAccount.pubkey;
        const userAccount = instruction.accounts.find((item) => item?.name === 'user');
        if (!userAccount || !userAccount.pubkey) {
            console.error('User account not found or invalid:', instruction.accounts);
            return null;
        }
        const user = userAccount.pubkey;
        const solAmount = type === "SELL"
            ? instruction.args.minSolOutput
            : instruction.args.maxSolCost;
        const tokenAmount = instruction.args.amount;
        if (solAmount === undefined || tokenAmount === undefined) {
            console.error('Invalid args:', instruction.args);
            return null;
        }
        return {
            type,
            mint,
            solAmount,
            tokenAmount,
            user
        };
    }
    catch (error) {
        console.error('Error in transactionOutput:', error);
        return null;
    }
}
//# sourceMappingURL=transactionOutput.js.map