/** Fondo decorativo RFS (azul #152483 · naranja #F16E26). */
export function BrandBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-rfs-50/70 to-rfsorange-50/60" />
      <div className="absolute -right-40 -top-44 h-[32rem] w-[32rem] rounded-full bg-rfs-700 animate-float-slow" />
      <div className="absolute -right-24 top-52 h-72 w-72 rounded-full bg-rfsorange-500" />
      <div className="absolute -bottom-44 -left-40 h-[28rem] w-[28rem] rounded-full bg-rfsorange-500 animate-float-slow" />
      <div className="absolute -bottom-24 left-24 h-60 w-60 rounded-full bg-rfs-600/85" />
      <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-rfsorange-400/50 blur-2xl" />
    </div>
  );
}
