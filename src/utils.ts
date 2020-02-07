export const parallelLimit = async <T>(promises: Promise<T>[], limit = 0) => {
  const runningPromises = new Set();

  return promises.map(async (promise) => {
    // Wait for any of the promises to resolve
    // And then push another one into the running set
    while (limit && runningPromises.size >= Math.floor(Number(limit))) {
      await Promise.race(runningPromises);
    }

    // Add promise to the running set
    runningPromises.add(promise);

    // Wait for the promise to finish
    const result = await promise;

    // Delete promise from the set when it is done
    runningPromises.delete(promise);

    return result;
  });
};
