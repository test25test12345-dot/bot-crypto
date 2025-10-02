import { DecimalUtil, getTokenPriceByUSD } from "../utils";
import bs58 from 'bs58'
import { InstructionParser } from "../jup-lib/instruction-parser";
import { IDL, Jupiter } from "../jup-lib/idl/jupiter";
import { AMM_TYPES, JUPITER_V6_PROGRAM_ID } from "../jup-lib/constant";
import { BN, Program, Provider } from "@coral-xyz/anchor";
import { getEvents } from "../jup-lib/get-events";
import { FeeEvent, SwapAttributes, SwapEvent, TransactionWithMeta } from "../jup-lib/types";
import { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import * as afx from '../global'
import { AccountInfo } from "@solana/web3.js";
import { unpackAccount, unpackMint } from "@solana/spl-token";
import Decimal from "decimal.js";
import { Message } from "@solana/web3.js";
import { getTokenDecimals } from "@jup-ag/dca-sdk";
// import { SolanaParser } from "@debridge-finance/solana-transaction-parser";

export const program = new Program<Jupiter>(
    IDL,
    JUPITER_V6_PROGRAM_ID,
    {} as Provider
);

export type AccountInfoMap = Map<string, AccountInfo<Buffer>>;

const reduceEventData = <T>(events: Event[], name: string) =>
    events.reduce((acc, event: any) => {
        if (event.name === name) {
            acc.push(event.data as T);
        }
        return acc;
    }, new Array<T>());

async function parseSwapEvents(
    accountInfosMap: AccountInfoMap,
    swapEvents: SwapEvent[]
) {
    const swapData = await Promise.all(
        swapEvents.map((swapEvent) => extractSwapData(accountInfosMap, swapEvent))
    );

    return swapData;
}

async function extractSwapData(
    accountInfosMap: AccountInfoMap,
    swapEvent: SwapEvent
) {
    const amm_key = swapEvent.amm.toBase58() as keyof typeof AMM_TYPES
    const amm =
        AMM_TYPES[amm_key] ??
        `Unknown program ${amm_key}`;

    const {
        mint: inMint,
        amount: inAmount,
        amountInDecimal: inAmountInDecimal,
        amountInUSD: inAmountInUSD,
    } = await extractVolume(
        accountInfosMap,
        swapEvent.inputMint,
        swapEvent.inputAmount
    );
    const {
        mint: outMint,
        amount: outAmount,
        amountInDecimal: outAmountInDecimal,
        amountInUSD: outAmountInUSD,
    } = await extractVolume(
        accountInfosMap,
        swapEvent.outputMint,
        swapEvent.outputAmount
    );

    return {
        amm,
        inMint,
        inAmount,
        inAmountInDecimal,
        inAmountInUSD,
        outMint,
        outAmount,
        outAmountInDecimal,
        outAmountInUSD,
    };
}

async function extractVolume(
    accountInfosMap: AccountInfoMap,
    mint: PublicKey,
    amount: BN
) {
    const tokenPriceInUSD = await getTokenPriceByUSD(mint.toBase58());
    let tokenDecimals = 6;
    try {
        tokenDecimals = extractMintDecimals(accountInfosMap, mint);
    } catch (error) {
        console.error(error);
    }
    // const tokenDecimals = 6;    
    const amountInDecimal = DecimalUtil.fromBN(amount, tokenDecimals);
    const amountInUSD = tokenPriceInUSD
        ? amountInDecimal.mul(tokenPriceInUSD)
        : undefined;

    return {
        mint: mint.toBase58(),
        amount: amount.toString(),
        amountInDecimal,
        amountInUSD,
    };
}

function extractTokenAccountOwner(
    accountInfosMap: AccountInfoMap,
    account: PublicKey
) {
    const accountData = accountInfosMap.get(account.toBase58());

    if (accountData) {
        try {
            const accountInfo = unpackAccount(account, accountData, accountData.owner);
            return accountInfo.owner;
        } catch (error) {
            console.log("unpack-error", error)
        }
    }

    return;
}

function extractMintDecimals(accountInfosMap: AccountInfoMap, mint: PublicKey) {
    const mintData = accountInfosMap.get(mint.toBase58());

    if (mintData) {        
        const mintInfo = unpackMint(mint, mintData, mintData.owner);        
        return mintInfo.decimals;      
    }

    return;
}

// export const getSwapInfoByParser = async (signature: any) => {
//     const txParser = new SolanaParser([{ idl: IDL, programId: JUPITER_V6_PROGRAM_ID }]);
//     const parsed = await txParser.parseTransaction(
//         afx.web3Conn,
//         signature,
//         false,
//     );

//     const tokenSwapIx = parsed?.find((pix) => pix.name === "tokenSwap");
//     return tokenSwapIx
// }

export const getJupiterSwapInfo = async (tx: VersionedTransactionResponse) => {
    try {
        const programId = JUPITER_V6_PROGRAM_ID;
        const accountInfosMap: AccountInfoMap = new Map();
        const parser = new InstructionParser(programId);
        const events = getEvents(program as any, tx, JUPITER_V6_PROGRAM_ID);
        const swapEvents = reduceEventData<SwapEvent>(events as any, "SwapEvent");
        const feeEvent = reduceEventData<FeeEvent>(events as any, "FeeEvent")[0];
        if (swapEvents.length === 0) {
            // Not a swap event, for example: https://solscan.io/tx/5ZSozCHmAFmANaqyjRj614zxQY8HDXKyfAs2aAVjZaadS4DbDwVq8cTbxmM5m5VzDcfhysTSqZgKGV1j2A2Hqz1V
            return;
        }
        const accountsToBeFetched = new Array<PublicKey>();
        swapEvents.forEach((swapEvent) => {
            accountsToBeFetched.push(swapEvent.inputMint);
            accountsToBeFetched.push(swapEvent.outputMint);
        });
        if (feeEvent) {
            accountsToBeFetched.push(feeEvent.account);
        }
        const accountInfos = await afx.web3Conn.getMultipleAccountsInfo(
            accountsToBeFetched
        );
        accountsToBeFetched.forEach((account, index) => {
            const accountInfo = accountInfos[index];
            if (accountInfo) {
                accountInfosMap.set(account.toBase58(), accountInfo);
            }
        });
        const swapData = await parseSwapEvents(accountInfosMap, swapEvents);
        const instructions = parser.getInstructions(tx);
        const intialAndFinalPosition: any = parser.getInitialAndFinalSwapPositions(instructions);

        if (!intialAndFinalPosition) {
            return null
        }
        const initialPositions = intialAndFinalPosition[0]
        const finalPositions = intialAndFinalPosition[1]
        const inSymbol = null; // We don't longer support this.
        const inMint = swapData[initialPositions[0]].inMint;
        const inSwapData = swapData.filter(
            (swap, index) => initialPositions.includes(index) && swap.inMint === inMint
        );
        const inAmount = inSwapData.reduce((acc, curr: any) => {
            return acc + BigInt(curr.inAmount);
        }, BigInt(0));
        const inAmountInDecimal = inSwapData.reduce((acc, curr) => {
            return acc.add(curr.inAmountInDecimal ?? 0);
        }, new Decimal(0));
        const inAmountInUSD = inSwapData.reduce((acc, curr) => {
            return acc.add(curr.inAmountInUSD ?? 0);
        }, new Decimal(0));

        const outSymbol = null; // We don't longer support this.
        const outMint = swapData[finalPositions[0]].outMint;
        const outSwapData = swapData.filter(
            (swap, index) => finalPositions.includes(index) && swap.outMint === outMint
        );
        const outAmount = outSwapData.reduce((acc, curr: any) => {
            return acc + BigInt(curr.outAmount);
        }, BigInt(0));
        const outAmountInDecimal = outSwapData.reduce((acc, curr) => {
            return acc.add(curr.outAmountInDecimal ?? 0);
        }, new Decimal(0));
        const outAmountInUSD = outSwapData.reduce((acc, curr) => {
            return acc.add(curr.outAmountInUSD ?? 0);
        }, new Decimal(0));

        const volumeInUSD =
            outAmountInUSD && inAmountInUSD
                ? Decimal.min(outAmountInUSD, inAmountInUSD)
                : outAmountInUSD ?? inAmountInUSD;

        const swap = {} as SwapAttributes;

        const [instructionName, transferAuthority, lastAccount] =
            parser.getInstructionNameAndTransferAuthorityAndLastAccount(instructions);

        swap.type = 'jupiter'
        swap.transferAuthority = transferAuthority;
        swap.lastAccount = lastAccount;
        swap.instruction = instructionName;
        const accountKeys = tx.version === 0 ? tx.transaction.message.staticAccountKeys : (tx.transaction.message as Message).accountKeys
        swap.owner = accountKeys[0].toBase58();
        swap.programId = programId.toBase58();
        swap.signature = tx.transaction.signatures[0];
        swap.timestamp = new Date(new Date((tx?.blockTime ?? 0)).toISOString());
        swap.legCount = swapEvents.length;
        swap.volumeInUSD = volumeInUSD.toNumber();

        swap.inSymbol = inSymbol;
        swap.inAmount = inAmount;
        swap.inAmountInDecimal = inAmountInDecimal.toNumber();
        swap.inAmountInUSD = inAmountInUSD.toNumber();
        swap.inMint = inMint;

        swap.outSymbol = outSymbol;
        swap.outAmount = outAmount;
        swap.outAmountInDecimal = outAmountInDecimal.toNumber();
        swap.outAmountInUSD = outAmountInUSD.toNumber();
        swap.outMint = outMint;
        const exactOutAmount = parser.getExactOutAmount(
            instructions
        );
        if (exactOutAmount) {
            swap.exactOutAmount = BigInt(exactOutAmount);

            if (outAmountInUSD) {
                swap.exactOutAmountInUSD = new Decimal(exactOutAmount)
                    .div(outAmount.toString())
                    .mul(outAmountInUSD)
                    .toNumber();
            }
        }

        const exactInAmount = parser.getExactInAmount(
            instructions
        );
        if (exactInAmount) {
            swap.exactInAmount = BigInt(exactInAmount);

            if (inAmountInUSD) {
                swap.exactInAmountInUSD = new Decimal(exactInAmount)
                    .div(inAmount.toString())
                    .mul(inAmountInUSD)
                    .toNumber();
            }
        }

        swap.swapData = JSON.parse(JSON.stringify(swapData));

        if (feeEvent) {
            const { mint, amount, amountInDecimal, amountInUSD } = await extractVolume(
                accountInfosMap,
                feeEvent.mint,
                feeEvent.amount
            );
            swap.feeTokenPubkey = feeEvent.account.toBase58();
            swap.feeOwner = extractTokenAccountOwner(
                accountInfosMap,
                feeEvent.account
            )?.toBase58();
            swap.feeAmount = BigInt(amount ?? 0);
            swap.feeAmountInDecimal = amountInDecimal?.toNumber();
            swap.feeAmountInUSD = amountInUSD?.toNumber();
            swap.feeMint = mint;
        }
        return swap;

    } catch (error) {
        // console.error('===========> copytrade.ts getSwapInfo error', error);
        // return null;
    }
}