export type Jupiter = {
    version: "0.1.0";
    name: "jupiter";
    instructions: [];
    accounts: [];
    types: [];
    events: [];
    errors: [];
    metadata?: {
        address: string;
    };
};
export declare const IDL: Jupiter;
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
export interface SwapEvent {
    amm: PublicKey;
    inputMint: PublicKey;
    inputAmount: BN;
    outputMint: PublicKey;
    outputAmount: BN;
}
export interface FeeEvent {
    account: PublicKey;
    mint: PublicKey;
    amount: BN;
}
export type IdlEvents<T> = {
    SwapEvent: SwapEvent;
    FeeEvent: FeeEvent;
};
export type IdlTypes<T> = {
    RoutePlanStep: {
        inputIndex: number;
        outputIndex: number;
    };
};
