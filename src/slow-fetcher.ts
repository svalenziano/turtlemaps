export type SlowFetchOptions = {
  url: string;
  options: RequestInit;
  resolve: Function;
  reject: Function;
}

/**
 * This class implements a `fetch` method that has an identical interface to
 * the native `fetch` and adds 'throttling' functionality.
 * 
 * There are more robust methods of throttling, but this does the trick for now
 */
export class SlowFetcher {
  queue: SlowFetchOptions[];
  timer: number | null;

/**
 * 
 * @param milliseconds Minimum interval between requests.  unit = milliseconds
 */
  constructor(public milliseconds: number) {
    this.queue = [];
    this.milliseconds = milliseconds;  // 
    this.timer = null;
  }

  async fetch(url: string, options: RequestInit) {
    let resolve: Function | null = null;
    let reject: Function | null = null;

    const futureFetch = await new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    // IF TIMER EXISTS, PUSH ARGUMENTS TO QUEUE FOR FUTURE FETCHING
    if (this.timer !== null) {
      if (!resolve || !reject) throw new Error("Functions don't exist");

      this.queue.push({url, options, resolve, reject});
      console.log("SlowFetcher: Pushing new fetch to queue");
      console.log(this.queue);
      return futureFetch;

    // IF NO TIMER EXISTS, CREATE THE TIMER AND PROCESS THIS FETCH IMMEDIATELY
    } else {
      // CREATE TIMER that resolves the `futureFetch`
      console.log("SlowFetcher: Creating timer")
      this.timer = setInterval(async () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift();

          if (!next) throw new Error("Queue was empty");

          const {url, options, resolve, reject} = next;
          const response = await fetch(url, options);

          if (response.ok) {
            resolve(response);
          } else {
            reject(response);
          }
        } else {
          console.log("SlowFetcher: Destroying timer");

          if (this.timer === null) throw new Error("No timer was found");

          clearInterval(this.timer);
          this.timer = null;
        }
      }, this.milliseconds); 
      
      // PROCESS IMMEDIATELY and return Promise
      // no `await`, since we want this method to act exactly like the native `fetch`
      return fetch(url, options);  
    }
  }
}