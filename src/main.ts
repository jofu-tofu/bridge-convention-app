import "./app.css";
import "./conventions/index";
import { mount } from "svelte";
import App from "./App.svelte";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export { app };
