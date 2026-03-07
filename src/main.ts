import "./app.css";
import "./conventions/index";
import { mount } from "svelte";
import App from "./App.svelte";

mount(App, {
  target: document.getElementById("app")!,
});
