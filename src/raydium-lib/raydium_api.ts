
import assert from 'assert';
import dotenv from 'dotenv'
import * as uniconst from '../uniconst'
import * as afx from '../global'
import * as utils from '../utils'

import { DelayDetector } from "../delay_detector"

dotenv.config()

import { LAMPORTS_PER_SOL, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js"
import { Market, MARKET_STATE_LAYOUT_V3, OpenOrders } from '@project-serum/serum'
import { Metaplex } from "@metaplex-foundation/js";
import { ENV, TokenListProvider } from "@solana/spl-token-registry";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";
import * as database from '../db'

import {
    LIQUIDITY_STATE_LAYOUT_V4,
    Token,
    Liquidity,
    TokenAmount,
    Percent,
    LOOKUP_TABLE_CACHE,
    MAINNET_PROGRAM_ID,
    DEVNET_PROGRAM_ID,
    ProgramId,
    SPL_ACCOUNT_LAYOUT,
    ENDPOINT,
    RAYDIUM_MAINNET,
    jsonInfo2PoolKeys,
    buildSimpleTransaction,
    TxVersion,
    CacheLTA
} from "@raydium-io/raydium-sdk";
import { derivePoolKeys } from '../poolkeys/poolKeysReassigned';
import { queryLpMintInfo } from '../graphQL/graph';

export const getProgramId = (): ProgramId => {
    if (ENV.MainnetBeta === afx.get_net_mode()) {
        return MAINNET_PROGRAM_ID
    } else {
        return DEVNET_PROGRAM_ID
    }
}

const getAddLookupTableInfo = (): CacheLTA | undefined => {
    if (ENV.MainnetBeta === afx.get_net_mode()) {
        return LOOKUP_TABLE_CACHE
    } else {
        return undefined
    }
}

export const getTokenPrice = async (tokenAddress: string): Promise<any> => {

    return await getTokenPriceBase(tokenAddress, uniconst.WSOL_ADDRESS, TOKEN_PROGRAM_ID)
}

export const getToken2022Price = async (tokenAddress: string): Promise<any> => {

    return await getTokenPriceBase(tokenAddress, uniconst.WSOL2022_ADDRESS, TOKEN_2022_PROGRAM_ID)
}

export const savePoolKeys = async (tokenAddress: string, marketId: string, reverse: number) => {
    let poolKeys = await derivePoolKeys(new PublicKey(marketId));
    database.updatePoolkeys(tokenAddress, poolKeys, reverse)
}
export const getTokenPriceBase = async (tokenAddress: string, nativeTokenAddress: string, tokenProgramId: PublicKey): Promise<any> => {

    const connection = afx.web3Conn
    assert(connection)

    try {

        let reverse = 0
        let poolKeys: any = null
        let lpData: any = null
        await new Promise(async (resolve: any, reject: any) => {
            let failureLeft = 2
            queryLpMintInfo(tokenAddress, nativeTokenAddress).then((ret: any) => {
                if (lpData) {
                    return null
                }
                if (!ret || ret.Raydium_LiquidityPoolv4.length === 0) {
                    if (--failureLeft <= 0) {
                        resolve(null)
                    }

                    return null
                }
                reverse = 0
                lpData = ret.Raydium_LiquidityPoolv4[0]
                resolve(ret)
            }).catch(error => {
                if (--failureLeft <= 0) {
                    resolve(null)
                }

                return null
            })
            queryLpMintInfo(nativeTokenAddress, tokenAddress).then((ret: any) => {
                if (lpData) {
                    return null
                }
                if (!ret || ret.Raydium_LiquidityPoolv4.length === 0) {
                    if (--failureLeft <= 0) {
                        resolve(null)
                    }

                    return null
                }

                reverse = 1
                lpData = ret.Raydium_LiquidityPoolv4[0]
                resolve(ret)
            }).catch(error => {
                if (--failureLeft <= 0) {
                    resolve(null)
                }

                return null
            })
        })
        if (lpData) {
            savePoolKeys(tokenAddress, lpData.marketId, reverse)
            const solVault = new PublicKey(reverse ? lpData.baseVault : lpData.quoteVault)
            const tokenVault = new PublicKey(reverse ? lpData.quoteVault : lpData.baseVault)
            let sol_check = await connection.getTokenAccountBalance(solVault)
            let token_check = await connection.getTokenAccountBalance(tokenVault)
            let price = sol_check.value.uiAmount / token_check.value.uiAmount
    
            let liquidity = sol_check.value.uiAmount * 2
            //console.log('--- Raydium', nativeTokenAddress, result)
            return { price: price, liquidity: liquidity }
        }
        // }
    } catch (error) {
        console.error(error)
    }

    return null
}

const makeTxVersion = TxVersion.V0;

export const buildBuySwapTrx = async (session: any, tokenAddress: string, nativeTokenAddress: string, tokenProgramId: PublicKey, buyAmount: number, wallet: Keypair, tokenMetaInfo: any, callback: Function): Promise<VersionedTransaction | null> => {

    const connection = afx.web3Conn
    assert(connection)

    try {

        const mint = new PublicKey(tokenAddress);
        const mintInfo = await getMint(connection, mint);
        let baseToken = new Token(tokenProgramId, new PublicKey(tokenAddress), mintInfo.decimals);
        let quoteToken = new Token(tokenProgramId, new PublicKey(nativeTokenAddress), uniconst.WSOL_DECIMALS);

        const slippage = new Percent(Math.floor(session.buySlippage * (10 ** 2)), 10000);
        const inputSolRawAmount = new TokenAmount(quoteToken, buyAmount, false);

        let poolKeys: any = null
        const poolkeys_db: any = await database.selectPoolkeys(tokenAddress)
        if (poolkeys_db) {
            poolKeys = poolkeys_db.poolkeys
        } else {
            return null
        }

        if (poolKeys) {
            const { minAmountOut, amountOut, currentPrice } = Liquidity.computeAmountOut({
                poolKeys: poolKeys,
                poolInfo: await Liquidity.fetchInfo({ connection, poolKeys }),
                amountIn: inputSolRawAmount,
                currencyOut: baseToken,
                slippage: slippage,
            });

            const walletTokenAccounts = await utils.getWalletTokenAccount(wallet.publicKey);

            const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
                connection,
                poolKeys,
                userKeys: {
                    tokenAccounts: walletTokenAccounts,
                    owner: wallet.publicKey,
                },
                amountIn: inputSolRawAmount,
                amountOut: minAmountOut,
                fixedSide: 'in',
                makeTxVersion,
            });

            const transactions: any = await buildSimpleTransaction({
                connection: connection,
                makeTxVersion: makeTxVersion,
                payer: wallet.publicKey,
                innerTransactions: innerTransactions,
                addLookupTableInfo: getAddLookupTableInfo(),
            });

            const tokenPrice = Number(currentPrice.invert().toSignificant())
            const outAmount = Number(amountOut.toSignificant())

            callback({
                success: 'true',
                data: {
                    price: tokenPrice,
                    solAmount: buyAmount,
                    amount: outAmount,
                    name: tokenMetaInfo.name,
                    decimals: baseToken.decimals,
                    mode: 'buy',
                    address: tokenAddress,
                    trxId: ''
                }
            })

            return transactions[0]
        }
    } catch (error) {
        console.error('[Radyum buyToken]', error)
    }

    return null
}
