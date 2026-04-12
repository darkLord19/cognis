import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// @ts-expect-error
import "./index.css";

// biome-ignore lint/style/noNonNullAssertion: root is always there
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
