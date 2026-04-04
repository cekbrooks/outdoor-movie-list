export function isUpcoming(date: string): boolean { return new Date(date) >= new Date(new Date().toDateString()); }
export function isScreeningToday(date: string): boolean { return date === new Date().toISOString().split("T")[0]; }
export function isScreeningTonight(date: string): boolean { return isScreeningToday(date); }
export function isThisWeekend(date: string): boolean { const now = new Date(); const day = now.getDay(); const fri = new Date(now); fri.setDate(now.getDate() + ((5 - day + 7) % 7)); fri.setHours(0,0,0,0); const sun = new Date(fri); sun.setDate(fri.getDate() + 2); sun.setHours(23,59,59,999); const d = new Date(date); return d >= fri && d <= sun; }
export function isWithinNextDays(date: string, days: number): boolean { const now = new Date(); now.setHours(0,0,0,0); const fut = new Date(now); fut.setDate(now.getDate() + days); const d = new Date(date); return d >= now && d <= fut; }
export function isThisCalendarMonth(date: string): boolean { const now = new Date(); const d = new Date(date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
export function formatRangeShort(from: Date, to: Date): string { const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }; return from.toLocaleDateString("en-GB",o) + " - " + to.toLocaleDateString("en-GB",o); }
export function priceCurrencyForCity(city: string): string { return city === "london" ? "GBP" : "USD"; }
export function screeningStartISO(date: string, time?: string): string { return date + "T" + (time ?? "20:00") + ":00"; }
