"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionFormatter = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@project-serum/anchor");
class TransactionFormatter {
    formTransactionFromJson(data, time) {
        const rawTx = data["transaction"];
        const slot = data.slot;
        const version = rawTx.transaction.message.versioned ? 0 : "legacy";
        const meta = this.formMeta(rawTx.meta);
        const signatures = rawTx.transaction.signatures.map((s) => anchor_1.utils.bytes.bs58.encode(s));
        const message = this.formTxnMessage(rawTx.transaction.message);
        return {
            slot,
            version,
            blockTime: time,
            meta,
            transaction: {
                signatures,
                message,
            },
        };
    }
    formTxnMessage(message) {
        if (!message.versioned) {
            return new web3_js_1.Message({
                header: {
                    numRequiredSignatures: message.header.numRequiredSignatures,
                    numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
                    numReadonlyUnsignedAccounts: message.header.numReadonlyUnsignedAccounts,
                },
                recentBlockhash: anchor_1.utils.bytes.bs58.encode(Buffer.from(message.recentBlockhash, "base64")),
                accountKeys: message.accountKeys?.map((d) => Buffer.from(d, "base64")),
                instructions: message.instructions.map(({ data, programIdIndex, accounts, }) => ({
                    programIdIndex: programIdIndex,
                    accounts: [...accounts],
                    data: anchor_1.utils.bytes.bs58.encode(Buffer.from(data || "", "base64")),
                })),
            });
        }
        else {
            return new web3_js_1.MessageV0({
                header: {
                    numRequiredSignatures: message.header.numRequiredSignatures,
                    numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
                    numReadonlyUnsignedAccounts: message.header.numReadonlyUnsignedAccounts,
                },
                recentBlockhash: anchor_1.utils.bytes.bs58.encode(Buffer.from(message.recentBlockhash, "base64")),
                staticAccountKeys: message.accountKeys.map((k) => new web3_js_1.PublicKey(Buffer.from(k, "base64"))),
                compiledInstructions: message.instructions.map(({ programIdIndex, accounts, data, }) => ({
                    programIdIndex: programIdIndex,
                    accountKeyIndexes: [...accounts],
                    data: Uint8Array.from(Buffer.from(data || "", "base64")),
                })),
                addressTableLookups: message.addressTableLookups?.map(({ accountKey, writableIndexes, readonlyIndexes, }) => ({
                    writableIndexes: writableIndexes || [],
                    readonlyIndexes: readonlyIndexes || [],
                    accountKey: new web3_js_1.PublicKey(Buffer.from(accountKey, "base64")),
                })) || [],
            });
        }
    }
    formMeta(meta) {
        return {
            err: meta.errorInfo ? { err: meta.errorInfo } : null,
            fee: meta.fee,
            preBalances: meta.preBalances,
            postBalances: meta.postBalances,
            preTokenBalances: meta.preTokenBalances || [],
            postTokenBalances: meta.postTokenBalances || [],
            logMessages: meta.logMessages || [],
            loadedAddresses: meta.loadedWritableAddresses || meta.loadedReadonlyAddresses
                ? {
                    writable: meta.loadedWritableAddresses?.map((address) => new web3_js_1.PublicKey(Buffer.from(address, "base64"))) || [],
                    readonly: meta.loadedReadonlyAddresses?.map((address) => new web3_js_1.PublicKey(Buffer.from(address, "base64"))) || [],
                }
                : undefined,
            innerInstructions: meta.innerInstructions?.map((i) => ({
                index: i.index || 0,
                instructions: i.instructions.map((instruction) => ({
                    programIdIndex: instruction.programIdIndex,
                    accounts: [...instruction.accounts],
                    data: anchor_1.utils.bytes.bs58.encode(Buffer.from(instruction.data || "", "base64")),
                })),
            })) || [],
        };
    }
}
exports.TransactionFormatter = TransactionFormatter;
//# sourceMappingURL=transaction-formatter.js.map