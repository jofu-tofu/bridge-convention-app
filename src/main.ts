import "./app.css";
import "./conventions/index";
import { mount } from "svelte";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) {
  throw new Error("Failed to find #app element in DOM");
}
mount(App, { target });
