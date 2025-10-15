import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
export declare const PUMP_FUN_PROGRAM_ID: PublicKey;
export declare function decodePumpfunTxn(tx: VersionedTransactionResponse): Promise<{
    signature: string;
    owner: string;
    type: string;
    inMint: string;
    outMint: string;
    inAmount: number;
    outAmount: number;
}>;
