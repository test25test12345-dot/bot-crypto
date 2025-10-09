import { Keypair, VersionedTransaction } from "@solana/web3.js";
import Decimal from 'decimal.js';
export declare const getTokenPrice: (tokenAddress: string) => Promise<number | null>;
export declare const getTokenPriceByUSD: (tokenAddress: string) => Promise<Decimal | null>;
export declare const getSwapInfo: (tokenFrom: string, tokenTo: string, amount: number, decimal: number, slippage: number) => Promise<any | null>;
export declare const buildSwapTrx: (session: any, wallet: Keypair, swapInfoResp: any) => Promise<VersionedTransaction>;
