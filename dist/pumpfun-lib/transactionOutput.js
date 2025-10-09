"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionOutput = transactionOutput;
function transactionOutput(txn) {
    const type = txn.instructions[0].name === "sell" ? "SELL" : "BUY";
    const mint = txn.instructions[0].accounts.find(((item) => (item.name === 'mint'))).pubkey;
    const solAmount = type === "SELL" ? txn.instructions[0].args.minSolOutput : txn.instructions[0].args.maxSolCost;
    const tokenAmount = txn.instructions[0].args.amount;
    const user = txn.instructions[0].accounts.find(((item) => (item.name === 'user'))).pubkey;
    return {
        type,
        mint,
        solAmount,
        tokenAmount,
        user
    };
}
//# sourceMappingURL=transactionOutput.js.map