// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function UtilityShell(props: any) {
  const { title, sub, children, className = "" } = props;
  return <div className={"utility-pop" + (className ? " " + className : "")} data-stop-pointerdown="1">
    <div className="utility-pop__header">
      <div>
        <h3>{title}</h3>
        {sub ? <p className="utility-sub">{sub}</p> : null}
      </div>
      <button className="utility-close" data-click="panel-close" aria-label={`Close ${title || "panel"}`}>×</button>
    </div>
    {children}
  </div>;
}