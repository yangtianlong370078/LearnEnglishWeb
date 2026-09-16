/* Update glass only when an overlay actually mounts/unmounts, including its
   exit animation. Avoid document-wide :has() invalidation when a browser
   assistant or a portaled select changes unrelated DOM. */
import { createGlassSourceFilter } from "./glass-source-filter";

type BackdropStack = {
  elements: Set<HTMLElement>;
  releaseSource: () => void;
};

const stacks = new WeakMap<Document, BackdropStack>();

function updateStack(document: Document, stack: Set<HTMLElement>) {
  const ordered = Array.from(stack).sort((a, b) =>
    a.compareDocumentPosition(b) & 4 ? -1 : 1,
  );
  const top = ordered[ordered.length - 1];

  document.body.toggleAttribute("data-glass-modal-open", ordered.length > 0);
  for (const element of ordered) {
    element.toggleAttribute("data-glass-backdrop-top", element === top);
  }
}

export function registerGlassBackdrop(element: HTMLElement) {
  const document = element.ownerDocument;
  let stack = stacks.get(document);

  if (!stack) {
    stack = {
      elements: new Set(),
      releaseSource: createGlassSourceFilter(document),
    };
    stacks.set(document, stack);
  }

  stack.elements.add(element);
  updateStack(document, stack.elements);

  return () => {
    stack.elements.delete(element);
    element.removeAttribute("data-glass-backdrop-top");
    updateStack(document, stack.elements);
    if (stack.elements.size === 0) {
      stack.releaseSource();
      stacks.delete(document);
    }
  };
}
