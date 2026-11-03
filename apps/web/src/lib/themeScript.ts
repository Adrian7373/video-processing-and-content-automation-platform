export const THEME_KEY = "sm-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before first paint (see layout.tsx) so the page never
 * flashes the wrong theme. Keep in sync with applyTheme below.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");if(m!=="light"&&m!=="dark")m="system";var d=document.documentElement;d.dataset.theme=m;d.classList.toggle("system-dark",window.matchMedia("${DARK_QUERY}").matches);}catch(e){document.documentElement.dataset.theme="system";}})();`;
