"use client";

import { useEffect } from "react";

export default function ShopLightTheme() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return null;
}
