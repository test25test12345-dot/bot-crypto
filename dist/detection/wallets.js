"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallets = void 0;
const utils_1 = require("../utils");
const database = __importStar(require("../db"));
const config_1 = require("./config");
const getWallets = async () => {
    let realWallets = [];
    await database.removeAllWallets();
    for (let wallet of config_1.wallets) {
        if ((0, utils_1.isValidAddress)(wallet.address)) {
            realWallets.push(wallet.address);
            const db_wallet = await database.selectTrackWallet({ wallet: wallet.address });
            if (db_wallet) {
                continue;
            }
            await database.updateTrackWallet({ wallet: wallet.address, tokens: [], name: wallet.name });
        }
    }
    console.log("Wallet Count: ", realWallets.length);
    return realWallets;
};
exports.getWallets = getWallets;
//# sourceMappingURL=wallets.js.map