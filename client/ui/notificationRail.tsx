// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { noticeAmount, noticeClassName, noticeRemainder, type NoticeItem } from "./notificationRailModel";

export function NotificationRailView({ notices = [] }: { notices: NoticeItem[] }) {
  return (
    <div className="notice-rail production-notice-rail" role="status" aria-live="polite" aria-relevant="additions text">
      {notices.map((n) => {
        const amount = noticeAmount(n.text);
        const rest = noticeRemainder(n.text, amount);
        return (
          <div className={noticeClassName(n) + " production-notice"} data-notice-id={String(n.id)}>
            {amount ? <b>{amount}</b> : null}
            <span>{amount ? rest : n.text}</span>
          </div>
        );
      })}
    </div>
  );
}