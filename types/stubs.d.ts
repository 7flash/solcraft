declare module 'tradjs' { export function serve(options: any): Promise<any>; }
declare module 'tradjs/web' { export function Head(props: any): any; }
declare module 'tradjs/client' { export function render(vnode:any, container:any): void; export function createElement(...args:any[]): any; }
declare module 'tradjs/client/jsx-runtime' { export const jsx:any; export const jsxs:any; export const Fragment:any; }
declare module 'tradjs/client/jsx-dev-runtime' { export const jsxDEV:any; export const Fragment:any; }
declare module 'three' { const THREE: any; export = THREE; export as namespace THREE; }
declare namespace JSX { interface IntrinsicElements { [elemName: string]: any } }
declare const Bun: any;
type ServerWebSocket<T = unknown> = any;
declare const process: any;
