/**
 * Framework integrations: keep the DOM-mutation detector from flagging the
 * page's own rendering. Each one calls handle.adoptPending() synchronously
 * after the framework writes to the DOM, before the MutationObserver callback
 * (a microtask) runs. No framework is imported; pass it in.
 */

/**
 * React: call the returned hook once in your root component.
 *   const useAntiSmith = createReactHook(React, antiSmith);
 *   function App() { useAntiSmith(); ... }
 * useLayoutEffect without dependencies runs after every commit, in the same task.
 */
export function createReactHook(React, handle) {
  return function useAntiSmith() {
    React.useLayoutEffect(() => {
      handle.adoptPending();
    });
  };
}

/**
 * Vue 3: app.use(vuePlugin(antiSmith)).
 * Unverified: whether Vue's post-flush hooks always run before the observer's microtask —
 * check with the lab before relying on it (docs/test-plan.md).
 */
export function vuePlugin(handle) {
  return {
    install(app) {
      app.mixin({
        mounted() {
          handle.adoptPending();
        },
        updated() {
          handle.adoptPending();
        },
      });
    },
  };
}

/**
 * Server-rendered pages with partial swaps (htmx, Turbo, Unpoly, your own fetch-and-swap):
 * adopt after each swap event. Returns a function that removes the listeners.
 */
export function adoptOnEvents(handle, events = ['htmx:afterSwap', 'htmx:oobAfterSwap', 'turbo:render', 'turbo:frame-render', 'up:fragment:inserted'], target = document) {
  const adopt = () => handle.adoptPending();
  for (const type of events) target.addEventListener(type, adopt);
  return () => events.forEach((type) => target.removeEventListener(type, adopt));
}

/** Plain JavaScript: render inside it and the new nodes are adopted. */
export function rendering(handle, render) {
  const result = render();
  handle.adoptPending();
  return result;
}
