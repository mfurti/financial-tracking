/** Each concept viewport owns its API, web server and disposable database, including boundary cases. */
export const conceptViewports = [360, 390, 700, 701, 768, 1024, 1100, 1101, 1440].map(
  /** Keep port/profile ownership deterministic without sharing mutable fixtures across projects. */ (
    width,
    index,
  ) => ({
    name: `concept-${width}`,
    width,
    height: width < 701 ? 844 : 1000,
    webPort: 4326 + index * 2,
    touch: width < 701,
  }),
);
