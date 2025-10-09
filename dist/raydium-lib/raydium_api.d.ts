import { PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";
import { ProgramId } from "@raydium-io/raydium-sdk";
export declare const getProgramId: () => ProgramId;
export declare const getTokenPrice: (tokenAddress: string) => Promise<any>;
export declare const getToken2022Price: (tokenAddress: string) => Promise<any>;
export declare const savePoolKeys: (tokenAddress: string, marketId: string, reverse: number) => Promise<void>;
export declare const getTokenPriceBase: (tokenAddress: string, nativeTokenAddress: string, tokenProgramId: PublicKey) => Promise<any>;
export declare const buildBuySwapTrx: (session: any, tokenAddress: string, nativeTokenAddress: string, tokenProgramId: PublicKey, buyAmount: number, wallet: Keypair, tokenMetaInfo: any, callback: Function) => Promise<VersionedTransaction | null>;
