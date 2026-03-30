import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

// DEBUG: catch all errors
window.addEventListener("error", (e) => {
  console.error("[GLOBAL ERROR]", e.message, e.filename, e.lineno, e.error);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[UNHANDLED REJECTION]", e.reason);
});

const target = document.getElementById("app");
if (!target) {
  throw new Error("Failed to find #app element in DOM");
}
mount(App, { target });
