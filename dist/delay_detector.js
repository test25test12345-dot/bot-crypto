"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayDetector = void 0;
class DelayDetector {
    startTime = 0;
    endTime = 0;
    tag = '';
    constructor(tag = '') {
        this.startTime = new Date().getTime();
        this.tag = tag;
    }
    estimate(log = true) {
        this.endTime = new Date().getTime();
        const spent = this.endTime - this.startTime;
        if (log) {
            console.log(`[${this.tag}] Duration: ${spent} ms`);
        }
        return spent;
    }
}
exports.DelayDetector = DelayDetector;
//# sourceMappingURL=delay_detector.js.map