import { Keypair, VersionedTransaction } from "@solana/web3.js";
export declare const swapToken: (type: string, session: any, tokenAddress: string, amount: number, wallet: Keypair) => Promise<VersionedTransaction>;
export declare const getTokenInfos: (address: string, token_decimals: number) => Promise<number | null>;
