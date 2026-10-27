const FIRST_POLL_MS = 50;
const MAX_POLL_MS = 250;

interface Clock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const realClock: Clock = {
  now: Date.now,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export async function pollWhile(
  check: () => Promise<boolean>,
  deadline: number,
  { now, sleep }: Clock = realClock
): Promise<void> {
  const poll = async (pollMs: number): Promise<void> => {
    if (now() >= deadline || !(await check())) {
      return;
    }
    await sleep(Math.min(pollMs, deadline - now()));
    await poll(Math.min(pollMs * 2, MAX_POLL_MS));
  };
  await poll(FIRST_POLL_MS);
}
