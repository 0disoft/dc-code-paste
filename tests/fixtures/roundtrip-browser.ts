import { roundtripHtmlSnapshot, roundtripOriginalFragment } from "#lib/editor/roundtrip-html.ts";
import { compareRoundtrip } from "#lib/editor/roundtrip-comparison.ts";

declare global {
  interface Window {
    roundtripTest: {
      snapshot: typeof roundtripHtmlSnapshot;
      fragment: typeof roundtripOriginalFragment;
      compare: typeof compareRoundtrip;
    };
  }
}
window.roundtripTest = {
  snapshot: roundtripHtmlSnapshot,
  fragment: roundtripOriginalFragment,
  compare: compareRoundtrip,
};
