import { MARKET_STATE_LAYOUT_V3 } from "@raydium-io/raydium-sdk";
import { RayLiqPoolv4 } from "../global";
import * as afx from '../global'
import { Message, PublicKey } from "@solana/web3.js";
import bs58 from 'bs58'
import { bnLayoutFormatter } from "../utils";
import { WSOL_ADDRESS } from "../uniconst";
import { VersionedTransactionResponse } from "@solana/web3.js";
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import { LogsParser } from "./logs-parser";
import {
    LIQUIDITY_STATE_LAYOUT_V4,
    struct,
    u64,
    u8
  } from "@raydium-io/raydium-sdk";

const IX_PARSER = new SolanaParser([]);
const LOGS_PARSER = new LogsParser();
const LAYOUT = struct([u8("type"), u64("amount")]);

export async function decodeRaydiumTxn(tx: VersionedTransactionResponse) {
  if (!tx.meta || tx.meta?.err) return;

  const parsedIxs = IX_PARSER.parseTransactionWithInnerInstructions(tx);

  const programIxs = parsedIxs.filter((ix) =>
      ix.programId.equals(RayLiqPoolv4),
  );

  if (programIxs.length === 0) return;
  const LogsEvent = LOGS_PARSER.parse(parsedIxs, tx.meta.logMessages as string[]);
  const result = { instructions: parsedIxs, events: LogsEvent };
  bnLayoutFormatter(result);
  let dexInstructions = result.instructions.filter((item) => item.name === 'transfer' && (item.programId as any) === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  let setFrom = false
  let swap: any = {}
  const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : (tx.transaction.message as Message).accountKeys
  swap.owner = accountKeys[0].toBase58();
  swap.signature = tx.transaction.signatures[0];
  swap.type = 'raydium'

  for (let i of dexInstructions) {
      if (i.name === 'transfer') {
          if (!setFrom) {
            const toAccount = i.accounts.find((item) => item.name === 'destination')
            if (toAccount) {
                let accountIndex = accountKeys.findIndex((item) => item.toString() === toAccount.pubkey.toString())
                let tokenMintInfo = tx.meta.postTokenBalances.find((item) => item.accountIndex === accountIndex)
                let fromMint = tokenMintInfo.mint
                if (fromMint === null || fromMint === WSOL_ADDRESS) {
                    swap.inMint = WSOL_ADDRESS;//buy
                } else {
                    swap.inMint = fromMint;//sell
                }
                swap.inAmount = (i.args as any).amount
                setFrom = true
            }

        } else {
            const sourceAccount = i.accounts.find((item) => item.name === 'source')
            if (sourceAccount) {
                let accountIndex = accountKeys.findIndex((item) => item.toString() === sourceAccount.pubkey.toString())
                let tokenMintInfo = tx.meta.postTokenBalances.find((item) => item.accountIndex === accountIndex)
                let toMint = tokenMintInfo.mint
                if (toMint === null || toMint === WSOL_ADDRESS) {
                    swap.outMint = WSOL_ADDRESS;//buy
                } else {
                    swap.outMint = toMint;//sell
                }
                swap.outAmount = (i.args as any).amount
            }
        }
      }
  }
  return swap;
}
  