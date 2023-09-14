type WaitForOptions = {
  timeout?: number;
  interval?: number;
};

export const waitFor = async (
  callback: () => void,
  { timeout = 1000, interval = 50 }: WaitForOptions = {},
) => {
  return new Promise((resolve, reject) => {
    waitForImpl(callback, Date.now(), resolve, reject, { timeout, interval });
  });
};

const waitForImpl = async (
  callback: () => void,
  startedAt: number,
  resolve: (value?: unknown) => void,
  reject: (error: unknown) => void,
  { timeout, interval }: Required<WaitForOptions>,
): Promise<void> => {
  try {
    callback();
    resolve();
  } catch (ex) {
    if (Date.now() - startedAt >= timeout) {
      reject(ex);
    } else {
      setTimeout(
        () =>
          waitForImpl(callback, startedAt, resolve, reject, {
            timeout,
            interval,
          }),
        interval,
      );
    }
  }
};
