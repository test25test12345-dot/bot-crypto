
import assert from 'assert';
import dotenv from 'dotenv'
import * as utils from '../utils'
import * as uniconst from '../uniconst'
import * as afx from '../global'

dotenv.config()

import { LAMPORTS_PER_SOL, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";
import Decimal from 'decimal.js';

export const getTokenPrice = async (tokenAddress: string): Promise<number | null> => {

	try {

		const url = `https://price.jup.ag/v4/price?ids=${tokenAddress}&vsToken=${uniconst.WSOL_ADDRESS}`
		const resp = await utils.fetchAPI(url, 'GET')

		if (resp && resp.data && resp.data[tokenAddress]) {
			return resp.data[tokenAddress].price
		}

	} catch (error) {

	}

	return null
}

const jupiterPrices: Map<string, any> = new Map();
const jupiterTTL: Map<string, number> = new Map();

export const getTokenPriceByUSD = async (tokenAddress: string): Promise<Decimal | null> => {

	try {
		let price = jupiterPrices.get(tokenAddress);
		let ttl = jupiterTTL.get(tokenAddress);

		// Cache for 2 seconds
		if (price && ttl && new Date().getTime() - ttl < 2 * 1000) {
			return new Decimal(price);
		}

		const url = `https://price.jup.ag/v4/price?ids=${tokenAddress}&vsToken=${uniconst.USDC_ADDRESS}`
		const resp = await utils.fetchAPI(url, 'GET')

		if (resp && resp.data && resp.data[tokenAddress]) {
			jupiterPrices.set(tokenAddress, price);
			jupiterTTL.set(tokenAddress, new Date().getTime());
			return new Decimal(resp.data[tokenAddress].price)
		}

	} catch (error) {
		console.log(`coin not found: ${tokenAddress}`);
	}

	return null
}

export const getSwapInfo = async (tokenFrom: string, tokenTo: string, amount: number, decimal: number, slippage: number): Promise<any | null> => {

	try {

		amount = Math.floor(amount * (10 ** decimal))
		slippage = Math.floor(slippage * (10 ** 2))

		const url = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenFrom}&outputMint=${tokenTo}&amount=${amount}&slippageBps=${slippage}`
		const resp = await utils.fetchAPI(url, 'GET')
		//console.log(resp)

		// if (resp && resp.routePlan && resp.routePlan.length > 0 && resp.routePlan[0] && resp.routePlan[0].swapInfo) {
		// 	return resp.routePlan[0].swapInfo
		// }

		return resp

	} catch (error) {

	}

	return null
}

export const buildSwapTrx = async (session: any, wallet: Keypair, swapInfoResp: any) => {

	try {
		console.log('buildSwapTrx', session.trxPriorityAmount)

		let resp = await utils.fetchAPI('https://quote-api.jup.ag/v6/swap', 'POST', {
			quoteResponse: swapInfoResp,
			userPublicKey: wallet.publicKey.toString(),
			wrapAndUnwrapSol: true,
		})

		if (!resp) {
			return null
		}

		const { swapTransaction } = resp;

		const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
		const transaction: VersionedTransaction = VersionedTransaction.deserialize(swapTransactionBuf);

		return transaction;

	} catch (error) {

		console.error("buildBuySwapTrx: ", error);
	}

	return null
}