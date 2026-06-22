import "./page.css";
import "./dusk-theme.css";
import "./referrals.css";
import "./playtest-polish.css";
import "./daylight-terrain.css";
import { publicRuntimeConfigScript } from "./runtimeConfig";

/* Server page — one container; the mount script owns everything inside. */
export default function GamePage() {
  return <>
    <script dangerouslySetInnerHTML={{ __html: publicRuntimeConfigScript() }} />
    <div id="solcraft-root" />
  </>;
}
