import "./index.css";
import { render } from "react-dom";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";

render(
  <AuthProvider>
    <App />
  </AuthProvider>,
  document.getElementById("root"),
);
