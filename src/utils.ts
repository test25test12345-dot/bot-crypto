import EventEmitter from 'events'
import axios from 'axios'

import * as fs from 'fs'

import assert from 'assert';
import * as afx from './global'

import * as crypto from './aes'
import { Concurrencer } from './concurrencer'
import * as uniconst from './uniconst'
import * as jpAPI from './jup-lib/jupiter_api'
import * as raydiumAPI from './raydium-lib/raydium_api'
import { DelayDetector } from "./delay_detector"
import { BN } from "@coral-xyz/anchor";
import { isObject } from "lodash";

import dotenv from 'dotenv'
dotenv.config()

import { LAMPORTS_PER_SOL, PublicKey, Keypair, Signer, VersionedTransaction, ParsedTransactionWithMeta, TransactionConfirmationStatus } from "@solana/web3.js"
import { Market, MARKET_STATE_LAYOUT_V3, OpenOrders } from '@project-serum/serum'
import { Metaplex } from "@metaplex-foundation/js";
import { ENV, TokenListProvider } from "@solana/spl-token-registry";
import { AccountLayout, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

import bs58 from "bs58";
import * as bip39 from "bip39";

import {
    LIQUIDITY_STATE_LAYOUT_V4,
    SPL_ACCOUNT_LAYOUT,
} from "@raydium-io/raydium-sdk";
import Decimal from 'decimal.js';
import * as pumpfun from './pumpfun-lib/swap'
import { wallets } from './detection/config';

export const isValidAddress = (address: string) => {
    try {
        const publicKey = new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
}

export async function getBalance(wallet: string) {

    assert(afx.web3Conn)

    return await afx.web3Conn.getBalance(new PublicKey(wallet)) / LAMPORTS_PER_SOL
}

export const shortenAddress = (address: string, length: number = 6) => {
    if (address.length < 2 + 2 * length) {
        return address; // Not long enough to shorten
    }

    const start = address.substring(0, length + 2);
    const end = address.substring(address.length - length);

    return start + "..." + end;
}

export const shortenString = (str: string, length: number = 8) => {

    if (length < 3) {
        length = 3
    }

    if (!str) {
        return "undefined"
    }

    if (str.length < length) {
        return str; // Not long enough to shorten
    }

    const temp = str.substring(0, length - 3) + '...';

    return temp;
}

export const limitString = (str: string, length: number = 8) => {

    if (length < 3) {
        length = 3
    }

    if (!str) {
        return "undefined"
    }

    if (str.length < length) {
        return str; // Not long enough to shorten
    }

    const temp = str.substring(0, length);

    return temp;
}

export const getTokenMetadata = async (address: string) => {

    assert(afx.web3Conn)

    try {

        const metaplex = Metaplex.make(afx.web3Conn);
        const mintAddress = new PublicKey(address);

        let name: string;
        let symbol: string;
        let logo: string;
        let decimals: number;
        let totalSupply: number;
        let renounced: boolean;
        let description: string;
        let extensions: any;

        const metadataAccount = metaplex
            .nfts()
            .pdas()
            .metadata({ mint: mintAddress });

        let infoObtainer = new Concurrencer()

        // const obtainer_index_token0 = infoObtainer.add(afx.web3Conn.getAccountInfo(metadataAccount))
        const obtainer_index_token1 = infoObtainer.add(
            (async () => {
                try {
                    return await getMint(afx.web3Conn, mintAddress)
                } catch (error) {
                    console.log('PASSED!!!', error)
                    return null
                }
            })())

        await infoObtainer.wait()

        // const metadataAccountInfo = infoObtainer.getResult(obtainer_index_token0)
        const mintInfo = infoObtainer.getResult(obtainer_index_token1)

        if (mintInfo) {
            const token: any = await metaplex.nfts().findByMint({ mintAddress: mintAddress });

            name = token.name;
            symbol = token.symbol;
            logo = token.json?.image;
            description = token.json?.description;
            extensions = {
                telegram: token.json?.telegram,
                twitter: token.json?.twitter,
                website: token.json?.website
            }
            decimals = token.mint.decimals;
            totalSupply = Number(mintInfo.supply / BigInt(10 ** decimals))
            renounced = token.mint.mintAuthorityAddress ? false : true;

            if (address === uniconst.WSOL_ADDRESS) {
                if (!logo) {
                    logo = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
                }
                if (!extensions) {
                    extensions = {
                        website: 'https://solana.com/'
                    }
                }
            }
            return { name, symbol, logo, decimals, address, totalSupply, description, extensions, renounced }
        }

    } catch (error) {
        console.log("utils.getTokenMetadata", error);
    }

    return null
}


export let SOL_PRICE = 0
export let LAST_GET_TIME = 0

export const getSOLPrice = async () => {
    if ((new Date()).getTime() - LAST_GET_TIME < 5000) {
        return SOL_PRICE
    }

    assert(afx.web3Conn)

    try {
        const info = await afx.web3Conn.getAccountInfo(new PublicKey(uniconst.SOL_USDC_POOL_ADDRESS));
        if (!info)
            return null

        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);

        const baseDecimal = 10 ** Number(poolState.baseDecimal); // e.g. 10 ^ 6
        const quoteDecimal = 10 ** Number(poolState.quoteDecimal);

        let infoObtainer = new Concurrencer()

        const obtainer_index_token0 = infoObtainer.add(OpenOrders.load(
            afx.web3Conn,
            poolState.openOrders,
            new PublicKey(uniconst.OPENBOOK_PROGRAM_ADDRESS)
        ))

        const obtainer_index_token1 = infoObtainer.add(afx.web3Conn.getTokenAccountBalance(
            poolState.baseVault
        ))

        const obtainer_index_token2 = infoObtainer.add(afx.web3Conn.getTokenAccountBalance(
            poolState.quoteVault
        ))

        await infoObtainer.wait()

        const openOrders = infoObtainer.getResult(obtainer_index_token0)
        const baseTokenAmount = infoObtainer.getResult(obtainer_index_token1)
        const quoteTokenAmount = infoObtainer.getResult(obtainer_index_token2)

        const basePnl = Number(poolState.baseNeedTakePnl) / baseDecimal;
        const quotePnl = Number(poolState.quoteNeedTakePnl) / quoteDecimal;

        const openOrdersBaseTokenTotal =
            Number(openOrders.baseTokenTotal) / baseDecimal;
        const openOrdersQuoteTokenTotal =
            Number(openOrders.quoteTokenTotal) / quoteDecimal;

        const base =
            (baseTokenAmount.value?.uiAmount || 0) + openOrdersBaseTokenTotal - basePnl;
        const quote =
            (quoteTokenAmount.value?.uiAmount || 0) +
            openOrdersQuoteTokenTotal -
            quotePnl;

        LAST_GET_TIME = (new Date()).getTime()
        SOL_PRICE = quote / base
        return SOL_PRICE

    } catch (error) {

    }

    return null
}

export const getTokenPrice = async (tokenAddress: string): Promise<any> => {

    return await raydiumAPI.getTokenPrice(tokenAddress)
}

export const getTokenPriceByUSD = async (tokenAddress: string): Promise<Decimal | null> => {

    // return await hmAPI.getTokenPrice(tokenAddress)
    return await jpAPI.getTokenPriceByUSD(tokenAddress)
}

export const fetchAPI = async (url: string, method: 'GET' | 'POST', data: Record<string, any> = {}): Promise<any | null> => {
    return new Promise(resolve => {
        if (method === "POST") {
            axios.post(url, data).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                // console.error('[fetchAPI]', error)
                resolve(null);
            });
        } else {
            axios.get(url).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                // console.error('fetchAPI', error);
                resolve(null);
            });
        }
    });
};

export const fetchAPIBy = async (url: string, method: 'GET' | 'POST', data: Record<string, any> = {}): Promise<any | null> => {
    return new Promise(resolve => {
        if (method === "POST") {
            axios.post(url, data).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                resolve(null);
            });
        } else {
            console.log(url);
            axios.get(url).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                console.error('fetchAPI', error);
                resolve(null);
            });
        }
    });
};

export const getShortenedAddress = (address: string) => {

    if (!address) {
        return ''
    }

    let str = address.slice(0, 24) + '...'

    return str
}

export const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function objectDeepCopy(obj: any, keysToExclude: string[] = []): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj; // Return non-objects as is
    }

    const copiedObject: Record<string, any> = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !keysToExclude.includes(key)) {
            copiedObject[key] = obj[key];
        }
    }

    return copiedObject;
}

export const getWalletTokenAccount = async (wallet: PublicKey) => {

    assert(afx.web3Conn)

    const walletTokenAccount = await afx.web3Conn.getTokenAccountsByOwner(wallet, {
        programId: TOKEN_PROGRAM_ID,
    });

    return walletTokenAccount.value.map((i) => ({
        pubkey: i.pubkey,
        programId: i.account.owner,
        accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
};

export const getWalletTokenBalance = async (wallet: PublicKey | string, tokenAddress: string, tokenDecimals: number = 6): Promise<number> => {

    if (typeof wallet === 'string') {
        wallet = new PublicKey(wallet);
    }
    const walletTokenAccounts = await getWalletTokenAccount(wallet);
    let tokenBalance = 0;
    if (walletTokenAccounts && walletTokenAccounts.length > 0) {
        for (const acc of walletTokenAccounts) {
            if (acc.accountInfo.mint.toBase58() === tokenAddress) {
                tokenBalance = Number(acc.accountInfo.amount) / (10 ** tokenDecimals);
                break
            }
        }
    }

    return tokenBalance
}

export const getWalletSOLBalance = async (wallet: PublicKey | string): Promise<number | null> => {

    if (typeof wallet === 'string') {
        wallet = new PublicKey(wallet);
    }

    assert(afx.web3Conn)
    try {
        let balance = await afx.web3Conn.getBalance(wallet) / LAMPORTS_PER_SOL
        return balance
    } catch (error) {
        console.log(error)
    }

    return null
}

export const getConfirmation = async (trx: string): Promise<TransactionConfirmationStatus | undefined> => {

    assert(afx.web3Conn)
    const result = await afx.web3Conn.getSignatureStatus(trx, {
        searchTransactionHistory: true,
    });

    return result.value?.confirmationStatus;
}

export const delayForTrxSync = async (signature: string) => {

    const delayDetector = new DelayDetector('delayForTrxSync')
    assert(afx.web3Conn)
    let tx: ParsedTransactionWithMeta | null = null

    console.log('delayForTrxSync start')
    while (delayDetector.estimate(false) < 60 * 1000) {
        if (await getConfirmation(signature) === 'finalized') {
            break
        }

        await sleep(500)
    }
    await sleep(1000)
    console.log('Delayed:', delayDetector.estimate(false))
}

export async function getTokenAddressFromTokenAccount(tokenAccountAddress: string) {
    // await sleep(2000)
    const startTime = (new Date()).getTime()
    while (true) {
        try {
            const nowTime = (new Date()).getTime()
            if ((nowTime - startTime) / 1000 > 60) {
                break;
            }
            const tokenAccountPubkey = new PublicKey(tokenAccountAddress);
            const accountInfo = await afx.web3Conn.getAccountInfo(tokenAccountPubkey);

            if (accountInfo === null) {
                // throw new Error('Token account not found');
                await sleep(1000)
                continue
            }

            const accountData = AccountLayout.decode(accountInfo.data);
            const mintAddress = new PublicKey(accountData.mint);

            // console.log(`Token address (mint address) for token account ${tokenAccountAddress}: ${mintAddress.toBase58()}`);
            return mintAddress.toBase58();
        } catch (error) {
            console.error('Error fetching token address:', error);
            await sleep(1000)
            continue
        }
    }

    return null

}

export function uint8ArrayToHexString(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
}

export class DecimalUtil {
    public static fromBigInt(input: BigInt, shift = 0): Decimal {
        return new Decimal(input.toString()).div(new Decimal(10).pow(shift));
    }

    public static fromBN(input: BN, shift = 0): Decimal {
        return new Decimal(input.toString()).div(new Decimal(10).pow(shift));
    }
}

export function bnLayoutFormatter(obj: any) {
    for (const key in obj) {
        if (obj[key]?.constructor?.name === "PublicKey") {
            obj[key] = (obj[key] as PublicKey).toBase58();
        } else if (obj[key]?.constructor?.name === "BN") {
            obj[key] = Number(obj[key].toString());
        } else if (obj[key]?.constructor?.name === "BigInt") {
            obj[key] = Number(obj[key].toString());
        } else if (obj[key]?.constructor?.name === "Buffer") {
            obj[key] = (obj[key] as Buffer).toString("base64");
        } else if (isObject(obj[key])) {
            bnLayoutFormatter(obj[key]);
        } else {
            obj[key] = obj[key];
        }
    }
}

export function bytesToInt(bytes: number[]): number {
    return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
}

export function bufferFromUInt64(value: number | string) {
    let buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
}

export function bytesToUInt64(bytes: any[]): bigint {
    if (bytes.length !== 8) {
        throw new Error("Input array must have exactly 8 bytes.");
    }
    return BigInt(bytes[0]) |
        (BigInt(bytes[1]) << BigInt(8)) |
        (BigInt(bytes[2]) << BigInt(16)) |
        (BigInt(bytes[3]) << BigInt(24)) |
        (BigInt(bytes[4]) << BigInt(32)) |
        (BigInt(bytes[5]) << BigInt(40)) |
        (BigInt(bytes[6]) << BigInt(48)) |
        (BigInt(bytes[7]) << BigInt(56));
}

export const getTokenPrice_ = async (addr: string) => {
    console.log("addr==========", addr)
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      };
    
    const fetchUrl: string = "https://public-api.birdeye.so/defi/price?address="+addr
      
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json())

    return responseData.data?.value ?? 0
}

export const getTokenMcapRaw = async (swap_data: any) => {
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      };

      const fetchUrl: string = "https://public-api.birdeye.so/defi/v3/token/market-data?address="+swap_data.outMint
            
      const responseData = await fetch(fetchUrl, options)
        .then(res => res.json())    

    return responseData.data?.marketcap ?? 0
}

export const getTokenMcap = async (swap_data: any) => {
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      };

      const fetchUrl: string = "https://public-api.birdeye.so/defi/v3/token/market-data?address="+swap_data.outMint
            
      const responseData = await fetch(fetchUrl, options)
        .then(res => res.json())

    console.log("responseData====", responseData, responseData.data, swap_data);

    let formattedMcap: string;
    const marketcap: any = responseData.data?.market_cap ?? 0
    if (marketcap > 10**6) {
        formattedMcap = (marketcap / 10**6).toFixed(1) + 'M';  // If greater than 1 million, show in millions
    } else if (marketcap > 10**3) {
        formattedMcap = (marketcap / 10**3).toFixed(1) + 'K';  // If greater than 1 thousand, show in thousands
    } else {
        // formattedMcap = responseData.data.marketcap.toFixed(0);  // If less than 1 thousand, show the value as it is
        formattedMcap = marketcap;  // If less than 1 thousand, show the value as it is
    }

    return formattedMcap
}
export const getTokenVolume = async (swap_data: any) => {
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      };

    const fetchUrl: string = "https://public-api.birdeye.so/defi/v3/token/trade-data/single?address="+swap_data.outMint
            
    const responseData = await fetch(fetchUrl, options)
      .then(res => res.json())   
    
    return responseData.data?.volume_30m_usd ?? 0
      
}

export const getTokenScore = async (buyWallets: any, swap_data: any) => {
    const tokenMCap = await getTokenMcapRaw(swap_data)
    const tokenVolume = await getTokenVolume(swap_data)
    let tokenPnl = 0
    
    for (const buywallet of buyWallets) {            
        const wallet = wallets.find((wallet: any) => wallet.address === buywallet.address)
        const walletTokenPnl = wallet?.pnl ?? 0
        tokenPnl += walletTokenPnl        
    }

    console.log("tradescore======", tokenMCap, tokenVolume, tokenPnl)    
    const tokenScore = tokenMCap / 10**7 * uniconst.MCAP_SCORE + tokenVolume/10**6 * uniconst.VOLUME_SCORE + tokenPnl/(100 * buyWallets.length) * uniconst.PNL_SCORE
    let tokenScoreInt: any = tokenScore * 5
    if (tokenScoreInt < 1) tokenScoreInt = 1
    if (tokenScoreInt > 10) tokenScoreInt = 10
    
    // return tokenScore.toFixed(3)
    return tokenScoreInt.toFixed(0)    
}


export const getTokenInfo = async (swap_data: any) => {
    const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.BIRDEYE_API_KEY
        }
      };
    
    const fetchUrl: string = "https://public-api.birdeye.so/defi/token_overview?address="+swap_data.outMint
      
    const responseData = await fetch(fetchUrl, options)
        .then(res => res.json())
    
    return responseData
}