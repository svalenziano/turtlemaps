// There are more robust methods of throttling, but this does the trick for now
export class SlowFetcher {
  constructor(milliseconds) {
    this.queue = [];
    this.milliseconds = milliseconds;  // Minimum interval between requests.  unit = milliseconds
    this.timer = null;
  }

  async fetch(url, options) {
    let resolve;
    let reject;

    const futureFetch =  new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    // IF TIMER EXISTS, PUSH ARGUMENTS TO QUEUE FOR FUTURE FETCHING
    if (this.timer !== null) {
      this.queue.push({url, options, resolve, reject});
      console.log("SlowFetcher: Pushing new fetch to queue")
      console.log(this.queue)
      return futureFetch;

    // IF NO TIMER EXISTS, CREATE THE TIMER AND PROCESS THIS FETCH IMMEDIATELY
    } else {
      // CREATE TIMER that resolves the `futureFetch`
      console.log("SlowFetcher: Creating timer")
      this.timer = setInterval(async () => {
        if (this.queue.length > 0) {
          const {url, options, resolve, reject} = this.queue.shift();
          const response = await fetch(url, options);
          if (response.ok) {
            resolve(response);
          } else {
            reject(response);
          }
        } else {
          console.log("SlowFetcher: Destroying timer")
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