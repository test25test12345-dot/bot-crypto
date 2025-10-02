import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { WSOL_DECIMALS } from "../uniconst";
import { fetchAPI, getSOLPrice } from "../utils";

export const swapToken = async (type: string, session: any, tokenAddress: string, amount: number, wallet: Keypair) => {
    try {
        const url = `https://pumpportal.fun/api/trade-local`
        let response: any = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "publicKey": wallet.publicKey,  // Your wallet public key
                "action": type,                 // "buy" or "sell"
                "mint": tokenAddress,         // contract address of the token you want to trade
                "denominatedInSol": type === "buy" ? "true" : "false",     // "true" if amount is amount of SOL, "false" if amount is number of tokens
                "amount": amount,                  // amount of SOL or tokens
                "slippage": type === "buy" ? session.buySlippage : session.sellSlippage,                   // percent slippage allowed
                "priorityFee": 0,
                "pool": "pump"                   // exchange to trade on. "pump" or "raydium"
            })
        });
        if (response && response.status === 200) {
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));
            return tx
        }
    } catch (error) {
        console.log("buy tx error", error)
    }
    return null
};

export const getTokenInfos = async (address: string, token_decimals: number): Promise<number | null> => {

    try {
        const solPrice = await getSOLPrice()
        if (!solPrice) {
            return null
        }
        const url = `https://frontend-api.pump.fun/coins/${address}`
        let resp = await fetchAPI(url, 'GET')
        if (resp) {
            resp.price = (resp.virtual_sol_reserves / resp.virtual_token_reserves) * 10 ** (token_decimals - WSOL_DECIMALS)
            resp.priceByUSD = resp.price * solPrice
            resp.liquidityByUSD = resp.virtual_sol_reserves / (10 ** WSOL_DECIMALS) * solPrice * 2
            return resp
        }
    } catch (error) {
    }

    return null
}