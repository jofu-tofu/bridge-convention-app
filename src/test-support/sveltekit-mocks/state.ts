/**
 * Mock for $app/state used in vitest.
 * Provides a minimal page state object.
 */
export const page = {
  url: new URL("http://localhost:1420/"),
  params: {},
  route: { id: "/" },
  status: 200,
  error: null,
  data: {},
  form: null,
  state: {},
};
