export function isUpcoming(d){return new Date(d)>=new Date(new Date().toDateString())}
export function isScreeningToday(d){return d===new Date().toISOString().split("T")[0]}
export function isScreeningTonight(d){return isScreeningToday(d)}
export function isThisWeekend(d){const n=new Date(),day=n.getDay(),f=new Date(n);f.setDate(n.getDate()+((5-day+7)%7));f.setHours(0,0,0,0);const s=new Date(f);s.setDate(f.getDate()+2);s.setHours(23,59,59,999);const dt=new Date(d);return dt>=f&&dt<=s}
export function isWithinNextDays(d,days){const n=new Date();n.setHours(0,0,0,0);const f=new Date(n);f.setDate(n.getDate()+days);const dt=new Date(d);return dt>=n&&dt<=f}
export function isThisCalendarMonth(d){const n=new Date(),dt=new Date(d);return dt.getMonth()===n.getMonth()&&dt.getFullYear()===n.getFullYear()}
export function formatRangeShort(f,t){const o={day:"numeric",month:"short"};return f.toLocaleDateString("en-GB",o)+" - "+t.toLocaleDateString("en-GB",o)}
export function priceCurrencyForCity(c){return c==="london"?"GBP":"USD"}
export function screeningStartISO(d,t){return d+"T"+(t||"20:00")+":00"}