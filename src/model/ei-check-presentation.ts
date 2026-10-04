/** Keep the actual check untouched. Generic explanatory notes are not replies. */
export function presentEICheck<T extends object>(check:T):Omit<T,'note'>{
 const {note:_note,...record}=check as T & {note?:unknown}
 return record
}
