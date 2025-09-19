import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerSW } from "./sw-register";

createRoot(document.getElementById("root")).render(<App />);

registerSW();
