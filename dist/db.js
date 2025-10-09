"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeTrackWallet = exports.updateTrackWallet = exports.removeAllWallets = exports.removeTrackPosition = exports.updateTrackPosition = exports.selectToken = exports.saveToken = exports.removeUser = exports.updateUser = exports.init = void 0;
exports.selectUsers = selectUsers;
exports.countUsers = countUsers;
exports.selectUser = selectUser;
exports.selectallTokens = selectallTokens;
exports.updatePoolkeys = updatePoolkeys;
exports.selectPoolkeys = selectPoolkeys;
exports.selectPositions = selectPositions;
exports.selectTrackPosition = selectTrackPosition;
exports.selectTrackWallets = selectTrackWallets;
exports.selectTrackWallet = selectTrackWallet;
const mongoose_1 = __importDefault(require("mongoose"));
const { ObjectId } = mongoose_1.default.Types;
const web3_js_1 = require("@solana/web3.js");
const User = mongoose_1.default.model('User', new mongoose_1.default.Schema({
    chatid: String,
    username: String,
    admin: Number,
    vip: Number,
    type: String,
    timestamp: Number,
}));
const Token = mongoose_1.default.model('Token', new mongoose_1.default.Schema({
    address: String,
    name: String,
    symbol: String,
    decimals: Number,
    description: String,
    logo: String,
    totalSupply: String,
}));
const Poolkeys = mongoose_1.default.model('Poolkeys', new mongoose_1.default.Schema({
    tokenAddress: String,
    poolkeys: Object,
    reverse: Number,
}));
const tokenType = new mongoose_1.default.Schema({
    mint: { type: String },
    type: { type: String },
    txTime: { type: String },
    inAmount: { type: Number }
});
const TrackWallet = mongoose_1.default.model('TrackWallet', new mongoose_1.default.Schema({
    wallet: String,
    name: String,
    tokens: { type: [tokenType] }
}));
const walletType = new mongoose_1.default.Schema({
    address: { type: String },
    name: { type: String },
    type: { type: String },
    inAmount: { type: Number },
    txTime: { type: String }
});
const Position = mongoose_1.default.model('Position', new mongoose_1.default.Schema({
    token: String,
    wallets: { type: [walletType] },
    old: Boolean,
}));
const init = () => {
    return new Promise(async (resolve, reject) => {
        mongoose_1.default.connect(`mongodb://localhost:27017/${process.env.DB_NAME}`)
            .then(() => {
            console.log(`Connected to MongoDB "${process.env.DB_NAME}"...`);
            resolve();
        })
            .catch(err => {
            console.error('Could not connect to MongoDB...', err);
            reject();
        });
    });
};
exports.init = init;
const updateUser = (params) => {
    return new Promise(async (resolve, reject) => {
        User.findOne({ chatid: params.chatid }).then(async (user) => {
            if (!user) {
                user = new User();
            }
            user.chatid = params.chatid;
            user.username = params.username;
            user.permit = params.permit;
            user.type = params.type;
            user.admin = params.admin;
            user.vip = params.vip;
            user.wallet = params.wallet;
            user.pkey = params.pkey;
            user.announce = params.announce;
            user.minPos = params.minPos;
            user.autoBuy = params.autoBuy;
            user.autoBuyAmount = params.autoBuyAmount;
            user.buyConfigLeft = params.buyConfigLeft;
            user.buyConfigRight = params.buyConfigRight;
            user.sellConfigLeft = params.sellConfigLeft;
            user.sellConfigRight = params.sellConfigRight;
            user.buySlippage = params.buySlippage;
            user.sellSlippage = params.sellSlippage;
            user.maxPriceImpact = params.maxPriceImpact;
            user.mevProtect = params.mevProtect;
            user.trxPriority = params.trxPriority;
            user.trxPriorityAmount = params.trxPriorityAmount;
            user.referredBy = params.referredBy;
            user.referralCode = params.referralCode;
            user.referredTimestamp = params.referredTimestamp;
            await user.save();
            resolve(user);
        });
    });
};
exports.updateUser = updateUser;
const removeUser = (params) => {
    return new Promise((resolve, reject) => {
        User.deleteOne({ chatid: params.chatid }).then(() => {
            resolve(true);
        });
    });
};
exports.removeUser = removeUser;
async function selectUsers(params = {}) {
    return new Promise(async (resolve, reject) => {
        User.find(params).then(async (users) => {
            resolve(users);
        });
    });
}
async function countUsers(params = {}) {
    return new Promise(async (resolve, reject) => {
        User.countDocuments(params).then(async (users) => {
            resolve(users);
        });
    });
}
async function selectUser(params) {
    return new Promise(async (resolve, reject) => {
        User.findOne(params).then(async (user) => {
            resolve(user);
        });
    });
}
async function selectallTokens(params) {
    return new Promise(async (resolve, reject) => {
        Token.find(params).then(async (tokens) => {
            resolve(tokens);
        });
    });
}
const saveToken = (params) => {
    return new Promise(async (resolve, reject) => {
        Token.findOne({ address: params.address }).then(async (token) => {
            if (!token) {
                token = new Token();
            }
            token.address = params.address;
            token.name = params.name;
            token.symbol = params.symbol;
            token.decimals = params.decimals;
            token.description = params.description;
            token.logo = params.logo;
            token.totalSupply = params.totalSupply;
            await token.save();
            resolve(token);
        });
    });
};
exports.saveToken = saveToken;
const selectToken = (params) => {
    return new Promise(async (resolve, reject) => {
        Token.findOne({ address: params.address }).then(async (token) => {
            resolve(token);
        });
    });
};
exports.selectToken = selectToken;
async function updatePoolkeys(tokenAddress, poolkeys, reverse) {
    return new Promise(async (resolve, reject) => {
        Poolkeys.findOne({ tokenAddress }).then(async (pool) => {
            if (!pool) {
                pool = new Poolkeys();
            }
            pool.tokenAddress = tokenAddress;
            pool.poolkeys = {
                keg: poolkeys.keg?.toString(),
                version: poolkeys.version,
                marketVersion: poolkeys.marketVersion,
                programId: poolkeys.programId.toString(),
                baseMint: poolkeys.baseMint.toString(),
                quoteMint: poolkeys.quoteMint.toString(),
                baseDecimals: poolkeys.baseDecimals,
                quoteDecimals: poolkeys.quoteDecimals,
                lpDecimals: poolkeys.lpDecimals,
                authority: poolkeys.authority.toString(),
                marketAuthority: poolkeys.marketAuthority.toString(),
                marketProgramId: poolkeys.marketProgramId.toString(),
                marketId: poolkeys.marketId.toString(),
                marketBids: poolkeys.marketBids.toString(),
                marketAsks: poolkeys.marketAsks.toString(),
                marketQuoteVault: poolkeys.marketQuoteVault.toString(),
                marketBaseVault: poolkeys.marketBaseVault.toString(),
                marketEventQueue: poolkeys.marketEventQueue.toString(),
                id: poolkeys.id.toString(),
                baseVault: poolkeys.baseVault.toString(),
                coinVault: poolkeys.coinVault.toString(),
                lpMint: poolkeys.lpMint.toString(),
                lpVault: poolkeys.lpVault.toString(),
                targetOrders: poolkeys.targetOrders.toString(),
                withdrawQueue: poolkeys.withdrawQueue.toString(),
                openOrders: poolkeys.openOrders.toString(),
                quoteVault: poolkeys.quoteVault.toString(),
                lookupTableAccount: poolkeys.lookupTableAccount.toString(),
            };
            pool.reverse = reverse;
            await pool.save();
            resolve(pool);
        });
    });
}
async function selectPoolkeys(tokenAddress) {
    return new Promise(async (resolve, reject) => {
        Poolkeys.findOne({ tokenAddress }).then(async (data) => {
            if (data) {
                let poolkeys = {
                    keg: new web3_js_1.PublicKey(data?.poolkeys.keg),
                    version: data?.poolkeys.version,
                    marketVersion: data?.poolkeys.marketVersion,
                    programId: new web3_js_1.PublicKey(data?.poolkeys.programId),
                    baseMint: new web3_js_1.PublicKey(data?.poolkeys.baseMint),
                    quoteMint: new web3_js_1.PublicKey(data?.poolkeys.quoteMint),
                    baseDecimals: data?.poolkeys.baseDecimals,
                    quoteDecimals: data?.poolkeys.quoteDecimals,
                    lpDecimals: data?.poolkeys.lpDecimals,
                    authority: new web3_js_1.PublicKey(data?.poolkeys.authority),
                    marketAuthority: new web3_js_1.PublicKey(data?.poolkeys.marketAuthority),
                    marketProgramId: new web3_js_1.PublicKey(data?.poolkeys.marketProgramId),
                    marketId: new web3_js_1.PublicKey(data?.poolkeys.marketId),
                    marketBids: new web3_js_1.PublicKey(data?.poolkeys.marketBids),
                    marketAsks: new web3_js_1.PublicKey(data?.poolkeys.marketAsks),
                    marketQuoteVault: new web3_js_1.PublicKey(data?.poolkeys.marketQuoteVault),
                    marketBaseVault: new web3_js_1.PublicKey(data?.poolkeys.marketBaseVault),
                    marketEventQueue: new web3_js_1.PublicKey(data?.poolkeys.marketEventQueue),
                    id: new web3_js_1.PublicKey(data?.poolkeys.id),
                    baseVault: new web3_js_1.PublicKey(data?.poolkeys.baseVault),
                    coinVault: new web3_js_1.PublicKey(data?.poolkeys.coinVault),
                    lpMint: new web3_js_1.PublicKey(data?.poolkeys.lpMint),
                    lpVault: new web3_js_1.PublicKey(data?.poolkeys.lpVault),
                    targetOrders: new web3_js_1.PublicKey(data?.poolkeys.targetOrders),
                    withdrawQueue: new web3_js_1.PublicKey(data?.poolkeys.withdrawQueue),
                    openOrders: new web3_js_1.PublicKey(data?.poolkeys.openOrders),
                    quoteVault: new web3_js_1.PublicKey(data?.poolkeys.quoteVault),
                    lookupTableAccount: new web3_js_1.PublicKey(data?.poolkeys.lookupTableAccount),
                };
                let result = { poolkeys, reverse: data.reverse };
                resolve(result);
            }
            else {
                resolve(data);
            }
        });
    });
}
const updateTrackPosition = (params) => {
    return new Promise(async (resolve, reject) => {
        try {
            const info = await Position.findOneAndUpdate({ token: params.token }, {
                token: params.token,
                wallets: params.wallets,
                old: params.old
            }, {
                new: true,
                upsert: true,
                runValidators: true
            });
            if (!info) {
                throw new Error('Failed to update or create wallet information');
            }
            resolve(info);
        }
        catch (error) {
            console.error("Error updating wallet:", error);
            reject(error);
        }
    });
};
exports.updateTrackPosition = updateTrackPosition;
async function selectPositions(params = {}) {
    return new Promise(async (resolve, reject) => {
        Position.find(params).then(async (positions) => {
            resolve(positions);
        });
    });
}
async function selectTrackPosition(params) {
    return new Promise(async (resolve, reject) => {
        Position.findOne(params).then(async (position) => {
            resolve(position);
        });
    });
}
const removeTrackPosition = (params) => {
    return new Promise((resolve, reject) => {
        Position.deleteOne(params).then(() => {
            resolve(true);
        });
    });
};
exports.removeTrackPosition = removeTrackPosition;
const removeAllWallets = () => {
    return new Promise((resolve, reject) => {
        TrackWallet.deleteMany({})
            .then(() => {
            resolve(true);
        })
            .catch((error) => {
            reject(error);
        });
    });
};
exports.removeAllWallets = removeAllWallets;
const updateTrackWallet = (params) => {
    return new Promise(async (resolve, reject) => {
        try {
            const info = await TrackWallet.findOneAndUpdate({ wallet: params.wallet }, {
                wallet: params.wallet,
                tokens: params.tokens,
                name: params.name
            }, {
                new: true,
                upsert: true,
                runValidators: true
            });
            if (!info) {
                throw new Error('Failed to update or create wallet information');
            }
            resolve(info);
        }
        catch (error) {
            console.error("Error updating wallet:", error);
            reject(error);
        }
    });
};
exports.updateTrackWallet = updateTrackWallet;
const removeTrackWallet = (params) => {
    return new Promise((resolve, reject) => {
        TrackWallet.deleteOne(params).then(() => {
            resolve(true);
        });
    });
};
exports.removeTrackWallet = removeTrackWallet;
async function selectTrackWallets(params = {}) {
    return new Promise(async (resolve, reject) => {
        TrackWallet.find(params).then(async (wallets) => {
            resolve(wallets);
        });
    });
}
async function selectTrackWallet(params) {
    return new Promise(async (resolve, reject) => {
        TrackWallet.findOne(params).then(async (wallet) => {
            resolve(wallet);
        });
    });
}
//# sourceMappingURL=db.js.map