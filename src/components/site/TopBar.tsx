"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, Globe, LogIn, Moon, Sun, Sunset, Timer } from "lucide-react";
import { useTheme } from "next-themes";
import { useI18n, LANGS } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const emptySubscribe = () => () => {};

export function TopBar() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [langOpen, setLangOpen] = useState(false);
  // يجنّب اختلاف الرندر بين الخادم والعميل قبل حل الثيم
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const themeCycle = () => {
    setTheme(theme === "dark" ? "sunlight" : theme === "sunlight" ? "light" : "dark");
  };
  const themeIcon = mounted && theme === "dark" ? <Moon className="h-4 w-4" /> : mounted && theme === "sunlight" ? <Sunset className="h-4 w-4" /> : <Sun className="h-4 w-4" />;

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label={t("brand")}>
          <span className="grid place-items-center w-8 h-8 rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Timer className="w-4 h-4" aria-hidden />
          </span>
          <span className="font-extrabold text-sm sm:text-base tracking-tight">{t("brand")}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm mr-2" aria-label="Main">
          <a href="#competitions" className="px-3 py-2 rounded-lg hover:bg-muted transition-colors font-medium">{t("navCompetitions")}</a>
          <a href="#leagues" className="px-3 py-2 rounded-lg hover:bg-muted transition-colors font-medium">{t("navLeagues")}</a>
          <a href="#how" className="px-3 py-2 rounded-lg hover:bg-muted transition-colors font-medium">{t("navHow")}</a>
        </nav>

        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={themeCycle} aria-label="theme toggle" className="shrink-0">
          {themeIcon}
        </Button>

        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setLangOpen(!langOpen)} aria-expanded={langOpen} className="gap-1.5 px-2.5">
            <Globe className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold uppercase">{lang}</span>
          </Button>
          {langOpen && (
            <>
              <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setLangOpen(false)} tabIndex={-1} />
              <div className="absolute end-0 mt-1 z-50 min-w-36 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg p-1">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full text-start px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors ${l.code === lang ? "font-extrabold text-primary" : ""}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 font-bold">
              <LogIn className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t("login")}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem asChild>
              <Link href="/league" className="flex flex-col gap-0.5 py-2">
                <span className="font-bold">{t("loginLeague")}</span>
                <span className="text-xs text-muted-foreground">{t("brandTag")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/competition" className="flex flex-col gap-0.5 py-2">
                <span className="font-bold">{t("loginCompetition")}</span>
                <span className="text-xs text-muted-foreground">LIG31-7K4M-Q9TX</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/coach" className="flex flex-col gap-0.5 py-2">
                <span className="font-bold">{t("loginClub")}</span>
                <span className="text-xs text-muted-foreground">{t("registerNow")}</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
