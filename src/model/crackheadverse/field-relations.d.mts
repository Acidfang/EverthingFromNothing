export type Role='WAS'|'IS'|'NEXT';
export const orders:Readonly<Record<'T1'|'T2'|'T3',Role[]>>;
export function localField(address:string,grain:string):{zero:string;grain:string;orientations:Array<{orientation:string;centre:string;axisOrigin:string;proceed:{address:string;origin:string;grain:string;role:null;relation:string};roles:Array<{address:string;role:Role;ordinal:number;origin:string;grain:string}>;signedRelations:Array<{address:string;orientation:string;sign:string;origin:string;grain:string}>}>;metricTransform:null;metricStatus:string};
export function backtrace<T extends {resultState:string;parentState:string|null}>(records:T[],address:string):T[];
