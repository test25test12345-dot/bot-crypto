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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aesDecrypt = exports.aesEncrypt = exports.aesCreateKey = void 0;
const crypto = __importStar(require("crypto"));
const assert_1 = __importDefault(require("assert"));
const aesCreateKey = () => {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const result = key.toString('base64') + ':' + iv.toString('base64');
    return result;
};
exports.aesCreateKey = aesCreateKey;
const aesEncrypt = (plainText, secret) => {
    const parts = secret.split(':');
    (0, assert_1.default)(parts.length == 2);
    const key = Buffer.from(parts[0], 'base64');
    const iv = Buffer.from(parts[1], 'base64');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};
exports.aesEncrypt = aesEncrypt;
const aesDecrypt = (encryptedText, secret) => {
    const parts = secret.split(':');
    (0, assert_1.default)(parts.length == 2);
    const key = Buffer.from(parts[0], 'base64');
    const iv = Buffer.from(parts[1], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};
exports.aesDecrypt = aesDecrypt;
//# sourceMappingURL=aes.js.map