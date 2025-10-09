export declare class DelayDetector {
    private startTime;
    private endTime;
    private tag;
    constructor(tag?: string);
    estimate(log?: boolean): number;
}
