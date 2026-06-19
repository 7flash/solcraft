// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function UtilityShell(props: any) {
  const { title, sub, children, className = "" } = props;
  return <div className={"utility-pop" + (className ? " " + className : "")} data-stop-pointerdown="1">
    <button className="utility-close" data-click="panel-close">×</button>
    <h3>{title}</h3>
    {sub ? <p className="utility-sub">{sub}</p> : null}
    {children}
  </div>;
}
