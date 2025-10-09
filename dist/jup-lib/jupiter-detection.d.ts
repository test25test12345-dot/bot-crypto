import { Jupiter } from "../jup-lib/idl/jupiter";
import { Program } from "@coral-xyz/anchor";
import { SwapAttributes } from "../jup-lib/types";
import { VersionedTransactionResponse } from "@solana/web3.js";
import { AccountInfo } from "@solana/web3.js";
export declare const program: Program<Jupiter>;
export type AccountInfoMap = Map<string, AccountInfo<Buffer>>;
export declare const getJupiterSwapInfo: (tx: VersionedTransactionResponse) => Promise<SwapAttributes>;
