import React from "react";

export function Logo({
  size = "md",
  showTagline = true,
  variant = "full",
  className = "",
  theme = "light"
}) {
  const isDark = theme === "dark";

  if (variant === "mark") {
    const markDimensions = {
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-14 h-14",
      xl: "w-20 h-20"
    }[size] || "w-10 h-10";

    return (
      <div className={`relative shrink-0 flex items-center justify-center ${markDimensions} ${className}`}>
        <img
          src="/src/assets/logo-mark.svg"
          alt="HisaabAI Symbol"
          className="w-full h-full object-contain filter drop-shadow-sm"
        />
      </div>
    );
  }

  // Full Horizontal Brand Logo
  const scaleStyles = {
    sm: "h-8",
    md: "h-11",
    lg: "h-14"
  }[size] || "h-11";

  return (
    <div className={`flex items-center gap-2.5 ${scaleStyles} ${className}`}>
      {/* Icon Mark */}
      <div className="h-full aspect-square shrink-0">
        <img
          src="/src/assets/logo-mark.svg"
          alt="HisaabAI Mark"
          className="h-full w-full object-contain"
        />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center leading-none">
          <span className={`font-extrabold tracking-tight text-lg sm:text-xl ${isDark ? "text-white" : "text-slate-900"}`}>
            Hisaab
          </span>
          <span className="font-black tracking-tight text-lg sm:text-xl bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent ml-0.5">
            AI
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-1 mb-2 animate-pulse"></span>
        </div>

        {showTagline && (
          <span className="text-[9px] font-bold tracking-widest text-slate-500 uppercase leading-tight mt-0.5">
            Retail Decision Intelligence
          </span>
        )}
      </div>
    </div>
  );
}

export default Logo;
