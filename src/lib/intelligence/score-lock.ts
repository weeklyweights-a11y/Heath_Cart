/** Serializes ProductScore writes per familyId (chat rescore + parallel shop requests). */
const chains = new Map<string, Promise<void>>();

export async function withFamilyScoreLock<T>(
  familyId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = chains.get(familyId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  chains.set(familyId, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (chains.get(familyId) === gate) {
      chains.delete(familyId);
    }
  }
}
