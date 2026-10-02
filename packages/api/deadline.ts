export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(message)), ms);
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () =>
      reject(controller.signal.reason),
    );
  });
  try {
    return await Promise.race([run(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
  }
}
