type WaitForOptions = {
  timeout?: number;
  interval?: number;
};

export const waitFor = async (
  callback: () => void,
  { timeout = 1000, interval = 50 }: WaitForOptions = {},
) => {
  await waitForImpl(callback, Date.now(), { timeout, interval });
};

const waitForImpl = async (
  callback: () => void,
  startedAt: number,
  { timeout, interval }: Required<WaitForOptions>,
) => {
  try {
    callback();
  } catch (ex) {
    if (Date.now() - startedAt >= timeout) {
      throw ex;
    }
    setTimeout(
      () => waitForImpl(callback, startedAt, { timeout, interval }),
      interval,
    );
  }
};
