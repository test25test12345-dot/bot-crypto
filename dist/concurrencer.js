"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Concurrencer = void 0;
class Concurrencer {
    pendingPromise = [];
    resultPromise = [];
    add(promise) {
        return this.pendingPromise.push(promise) - 1;
    }
    async wait() {
        return new Promise(async (resolve, reject) => {
            Promise.all(this.pendingPromise).then(result => {
                this.resultPromise = result;
                resolve(result);
            });
        });
    }
    getResult(index) {
        return this.resultPromise[index];
    }
}
exports.Concurrencer = Concurrencer;
//# sourceMappingURL=concurrencer.js.map