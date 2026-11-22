/** What an exercise gets when it runs as one step of a drill. */
export interface DrillStep {
  /** Becomes true when the intro popup has closed; the exercise then starts by itself. */
  start: boolean;
  /** The last step of the drill. */
  isLast: boolean;
  /** Called from the summary with a one-line result, such as "7/10 correct". */
  onFinish: (result: string) => void;
}
