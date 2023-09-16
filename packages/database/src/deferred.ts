export default class Deferred<T> {
  private _promise: Promise<T>;
  private _resolve: (value: T) => void;
  private _reject: (error: unknown) => void;

  constructor() {
    let res: (value: T) => void;
    let rej: (error: unknown) => void;

    this._promise = new Promise((resolve, reject) => {
      res = resolve;
      rej = reject;
    });

    this._resolve = res!;
    this._reject = rej!;
  }

  get promise() {
    return this._promise;
  }

  resolve(value: T) {
    this._resolve(value);
  }

  reject(error: unknown) {
    this._reject(error);
  }
}
