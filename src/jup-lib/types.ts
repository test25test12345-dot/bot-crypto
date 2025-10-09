import { ParsedInstruction, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

// Definisci manualmente i tipi basandoti sulla struttura dell'IDL di Jupiter
export type SwapEvent = {
  amm: PublicKey;
  inputMint: PublicKey;
  inputAmount: BN;
  outputMint: PublicKey;
  outputAmount: BN;
};

export type FeeEvent = {
  account: PublicKey;
  mint: PublicKey;
  amount: BN;
};

export type RoutePlanStep = {
  swap: any;
  percent: number;
  inputIndex: number;
  outputIndex: number;
};

export type RoutePlan = RoutePlanStep[];

export interface PartialInstruction {
  programIdIndex: number; 
  programId: PublicKey;
  data: string /** Expecting base58 */;
  accounts?: PublicKey[];
  accountKeyIndexes?: PublicKey[];
}

// Subset of @solana/web3.js ParsedTransactionWithMeta to allow flexible upstream data
export interface TransactionWithMeta {
  meta: {
    logMessages?: string[] | null;
    innerInstructions?:
      | {
          index: number;
          instructions: (ParsedInstruction | PartialInstruction)[];
        }[]
      | null;
  } | null;
  transaction: {
    signatures: string[];
    message: {
      accountKeys: { pubkey: PublicKey }[];
      instructions: (ParsedInstruction | PartialInstruction)[];
    };
  };
}

export type SwapAttributes = {
  owner: string;
  type: string;
  transferAuthority: string;
  programId: string;
  signature: string;
  timestamp: Date;
  legCount: number;
  volumeInUSD: number;
  inSymbol: string | null;
  inAmount: BigInt;
  inAmountInDecimal?: number;
  inAmountInUSD: number;
  inMint: string;
  outSymbol: string | null;
  outAmount: BigInt;
  outAmountInDecimal?: number;
  outAmountInUSD: number;
  outMint: string;
  instruction: string;
  exactInAmount: BigInt;
  exactInAmountInUSD: number;
  exactOutAmount: BigInt;
  exactOutAmountInUSD: number;
  swapData: JSON;
  feeTokenPubkey?: string;
  feeOwner?: string;
  feeSymbol?: string;
  feeAmount?: BigInt;
  feeAmountInDecimal?: number;
  feeAmountInUSD?: number;
  feeMint?: string;
  tokenLedger?: string;
  lastAccount: string; // This can be a tracking account since we don't have a way to know we just log it the last account.
};
