import React from "react";
import { useLocation } from "react-router-dom";

export default function PageTransition({ children }) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="animate-page-enter transition-all duration-300 ease-out"
    >
      {children}
    </div>
  );
}
