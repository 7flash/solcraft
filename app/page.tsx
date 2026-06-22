import { publicRuntimeConfigScript } from "./runtimeConfig";

/* TradJS server page: one mount node, runtime config injected before the client boots. */
export default function GamePage() {
  return <>
    <script dangerouslySetInnerHTML={{ __html: publicRuntimeConfigScript() }} />
    <div id="solcraft-root" />
  </>;
}
