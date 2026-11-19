import { useState, type ComponentType } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

// Map common names and aliases to exact skillicons.dev identifiers
const SKILL_ICON_MAP: Record<string, string> = {
  wordpress: "wordpress",
  fastapi: "fastapi",
  "node.js": "nodejs",
  nodejs: "nodejs",
  node: "nodejs",
  react: "react",
  laravel: "laravel",
  django: "django",
  express: "express",
  postgresql: "postgres",
  postgres: "postgres",
  redis: "redis",
  mongodb: "mongodb",
  docker: "docker",
  nginx: "nginx",
  mariadb: "mysql",
  mysql: "mysql",
  php: "php",
  nextjs: "nextjs",
  "next.js": "nextjs",
  vue: "vue",
  "vue.js": "vue",
  vuejs: "vue",
  golang: "go",
  go: "go",
  rust: "rust",
  python: "python",
  javascript: "js",
  js: "js",
  typescript: "ts",
  ts: "ts",
  html: "html",
  css: "css",
  tailwind: "tailwindcss",
  tailwindcss: "tailwindcss",
  graphql: "graphql",
  prisma: "prisma",
  supabase: "supabase",
  firebase: "firebase",
  flask: "flask",
  git: "git",
  github: "github",
  gitlab: "gitlab",
  jenkins: "jenkins",
  ansible: "ansible",
  cloudflare: "cloudflare",
  linux: "linux",
  bash: "bash",
  apple: "apple",
  windows: "windows",
};

interface SkillIconProps {
  name: string;
  size?: number | string;
  className?: string;
  fallbackIcon?: ComponentType<{ className?: string }>;
  alt?: string;
}

export function SkillIcon({
  name,
  size = 44,
  className,
  fallbackIcon: FallbackIcon = Package,
  alt,
}: SkillIconProps) {
  const [hasError, setHasError] = useState(false);

  const normalized = name.toLowerCase().trim();
  const iconKey = SKILL_ICON_MAP[normalized] || normalized.replace(/[^a-z0-9]/g, "");

  // If skillicons doesn't have an icon or errored out, show fallback
  if (hasError) {
    return <FallbackIcon className={cn("size-6", className)} />;
  }

  const iconUrl = `https://skillicons.dev/icons?i=${iconKey}`;

  return (
    <img
      src={iconUrl}
      alt={alt || `${name} icon`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn(
        "shrink-0 select-none rounded-xl transition-transform duration-200 hover:scale-105 drop-shadow-sm",
        className
      )}
      style={{ width: size, height: size }}
    />
  );
}
