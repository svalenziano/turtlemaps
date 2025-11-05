"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlowFetcher = void 0;
// There are more robust methods of throttling, but this does the trick for now
class SlowFetcher {
    constructor(milliseconds) {
        this.queue = [];
        this.milliseconds = milliseconds; // Minimum interval between requests.  unit = milliseconds
        this.timer = null;
    }
    fetch(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let resolve;
            let reject;
            const futureFetch = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });
            // IF TIMER EXISTS, PUSH ARGUMENTS TO QUEUE FOR FUTURE FETCHING
            if (this.timer !== null) {
                this.queue.push({ url, options, resolve, reject });
                console.log("SlowFetcher: Pushing new fetch to queue");
                console.log(this.queue);
                return futureFetch;
                // IF NO TIMER EXISTS, CREATE THE TIMER AND PROCESS THIS FETCH IMMEDIATELY
            }
            else {
                // CREATE TIMER that resolves the `futureFetch`
                console.log("SlowFetcher: Creating timer");
                this.timer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    if (this.queue.length > 0) {
                        const { url, options, resolve, reject } = this.queue.shift();
                        const response = yield fetch(url, options);
                        if (response.ok) {
                            resolve(response);
                        }
                        else {
                            reject(response);
                        }
                    }
                    else {
                        console.log("SlowFetcher: Destroying timer");
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                }), this.milliseconds);
                // PROCESS IMMEDIATELY and return Promise
                // no `await`, since we want this method to act exactly like the native `fetch`
                return fetch(url, options);
            }
        });
    }
}
exports.SlowFetcher = SlowFetcher;
