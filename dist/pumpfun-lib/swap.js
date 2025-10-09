"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenInfos = exports.swapToken = void 0;
const web3_js_1 = require("@solana/web3.js");
const uniconst_1 = require("../uniconst");
const utils_1 = require("../utils");
const swapToken = async (type, session, tokenAddress, amount, wallet) => {
    try {
        const url = `https://pumpportal.fun/api/trade-local`;
        let response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "publicKey": wallet.publicKey,
                "action": type,
                "mint": tokenAddress,
                "denominatedInSol": type === "buy" ? "true" : "false",
                "amount": amount,
                "slippage": type === "buy" ? session.buySlippage : session.sellSlippage,
                "priorityFee": 0,
                "pool": "pump"
            })
        });
        if (response && response.status === 200) {
            const data = await response.arrayBuffer();
            const tx = web3_js_1.VersionedTransaction.deserialize(new Uint8Array(data));
            return tx;
        }
    }
    catch (error) {
        console.log("buy tx error", error);
    }
    return null;
};
exports.swapToken = swapToken;
const getTokenInfos = async (address, token_decimals) => {
    try {
        const solPrice = await (0, utils_1.getSOLPrice)();
        if (!solPrice) {
            return null;
        }
        const url = `https://frontend-api.pump.fun/coins/${address}`;
        let resp = await (0, utils_1.fetchAPI)(url, 'GET');
        if (resp) {
            resp.price = (resp.virtual_sol_reserves / resp.virtual_token_reserves) * 10 ** (token_decimals - uniconst_1.WSOL_DECIMALS);
            resp.priceByUSD = resp.price * solPrice;
            resp.liquidityByUSD = resp.virtual_sol_reserves / (10 ** uniconst_1.WSOL_DECIMALS) * solPrice * 2;
            return resp;
        }
    }
    catch (error) {
    }
    return null;
};
exports.getTokenInfos = getTokenInfos;
//# sourceMappingURL=swap.js.map