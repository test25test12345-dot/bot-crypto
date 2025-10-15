import { VersionedTransactionResponse } from "@solana/web3.js";
export declare function getJupiterSwapInfo(tx: VersionedTransactionResponse): Promise<{
    signature: string;
    owner: string;
    type: string;
    inMint: string;
    outMint: string;
    inAmount: number;
    outAmount: number;
}>;
