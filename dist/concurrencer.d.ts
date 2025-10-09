export declare class Concurrencer {
    private pendingPromise;
    private resultPromise;
    add(promise: Promise<any>): number;
    wait(): Promise<void>;
    getResult(index: number): any;
}
